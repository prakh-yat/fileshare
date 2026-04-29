import net from "node:net";
import tls from "node:tls";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
};

export type SmtpResult = {
  success: boolean;
  steps: Array<{ step: string; response: string; ok: boolean }>;
  error?: string;
  durationMs: number;
};

function readUntil(socket: net.Socket | tls.TLSSocket, regex: RegExp, timeout = 15000) {
  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for ${regex}. Last buffer: ${buffer.slice(-300)}`)),
      timeout,
    );
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      if (regex.test(buffer)) {
        clearTimeout(timer);
        socket.off("data", onData);
        resolve(buffer);
      }
    };
    socket.on("data", onData);
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

export async function smtpSend({
  config,
  to,
  subject,
  text,
  html,
}: {
  config: SmtpConfig;
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SmtpResult> {
  const start = Date.now();
  const steps: SmtpResult["steps"] = [];
  let socket: net.Socket | undefined;
  let tlsSocket: tls.TLSSocket | undefined;

  try {
    socket = net.connect({ host: config.host, port: config.port });
    const greeting = await readUntil(socket, /^220 /m);
    steps.push({ step: "connect", response: greeting.trim(), ok: true });

    socket.write("EHLO supabase-fileshare\r\n");
    const ehloResp = await readUntil(socket, /^250 /m);
    steps.push({ step: "EHLO", response: lastLine(ehloResp), ok: true });

    socket.write("STARTTLS\r\n");
    const starttls = await readUntil(socket, /^220 /m);
    steps.push({ step: "STARTTLS", response: lastLine(starttls), ok: true });

    tlsSocket = tls.connect({ socket, servername: config.host, rejectUnauthorized: true });
    await new Promise<void>((resolve, reject) => {
      tlsSocket!.once("secureConnect", () => resolve());
      tlsSocket!.once("error", reject);
    });

    tlsSocket.write("EHLO supabase-fileshare\r\n");
    const tlsEhlo = await readUntil(tlsSocket, /^250 /m);
    steps.push({ step: "EHLO over TLS", response: lastLine(tlsEhlo), ok: true });

    tlsSocket.write("AUTH LOGIN\r\n");
    await readUntil(tlsSocket, /^334 /m);

    tlsSocket.write(`${Buffer.from(config.user).toString("base64")}\r\n`);
    await readUntil(tlsSocket, /^334 /m);

    tlsSocket.write(`${Buffer.from(config.pass).toString("base64")}\r\n`);
    const authResp = await readUntil(tlsSocket, /^(235|535|530|454) /m);
    if (!authResp.startsWith("235")) {
      steps.push({ step: "AUTH LOGIN", response: lastLine(authResp), ok: false });
      throw new Error(`SMTP authentication failed: ${lastLine(authResp)}`);
    }
    steps.push({ step: "AUTH LOGIN", response: lastLine(authResp), ok: true });

    tlsSocket.write(`MAIL FROM:<${config.fromEmail}>\r\n`);
    const fromResp = await readUntil(tlsSocket, /^(250|550|553|554) /m);
    if (!fromResp.startsWith("250")) {
      steps.push({ step: "MAIL FROM", response: lastLine(fromResp), ok: false });
      throw new Error(`Sender rejected: ${lastLine(fromResp)}`);
    }
    steps.push({ step: "MAIL FROM", response: lastLine(fromResp), ok: true });

    tlsSocket.write(`RCPT TO:<${to}>\r\n`);
    const rcptResp = await readUntil(tlsSocket, /^(250|550|553|554|450) /m);
    if (!rcptResp.startsWith("250")) {
      steps.push({ step: "RCPT TO", response: lastLine(rcptResp), ok: false });
      throw new Error(`Recipient rejected: ${lastLine(rcptResp)}`);
    }
    steps.push({ step: "RCPT TO", response: lastLine(rcptResp), ok: true });

    tlsSocket.write("DATA\r\n");
    await readUntil(tlsSocket, /^354 /m);

    const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@${config.host}>`;
    const fromHeader = config.fromName
      ? `"${config.fromName.replaceAll('"', "")}" <${config.fromEmail}>`
      : config.fromEmail;
    const boundary = `==boundary-${Date.now()}`;
    const message = html
      ? [
          `From: ${fromHeader}`,
          `To: <${to}>`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          `MIME-Version: 1.0`,
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          ``,
          `--${boundary}`,
          `Content-Type: text/plain; charset=UTF-8`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          text,
          ``,
          `--${boundary}`,
          `Content-Type: text/html; charset=UTF-8`,
          `Content-Transfer-Encoding: 7bit`,
          ``,
          html,
          ``,
          `--${boundary}--`,
          ``,
          `.`,
          ``,
        ].join("\r\n")
      : [
          `From: ${fromHeader}`,
          `To: <${to}>`,
          `Subject: ${subject}`,
          `Message-ID: ${messageId}`,
          `Date: ${new Date().toUTCString()}`,
          `MIME-Version: 1.0`,
          `Content-Type: text/plain; charset=UTF-8`,
          ``,
          text,
          ``,
          `.`,
          ``,
        ].join("\r\n");

    tlsSocket.write(message);
    const dataResp = await readUntil(tlsSocket, /^(250|550|554|421) /m);
    const dataOk = dataResp.startsWith("250");
    steps.push({ step: "DATA", response: lastLine(dataResp), ok: dataOk });

    tlsSocket.write("QUIT\r\n");
    tlsSocket.end();

    return {
      success: dataOk,
      steps,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      success: false,
      steps,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  } finally {
    try {
      tlsSocket?.destroy();
    } catch {
      /* noop */
    }
    try {
      socket?.destroy();
    } catch {
      /* noop */
    }
  }
}

function lastLine(value: string) {
  const lines = value.trim().split(/\r?\n/);
  return lines[lines.length - 1] ?? value.trim();
}

// Code heavily borrowed from https://github.com/mautrix/discord/commit/704bdaefd7b5874713f744c1b29f26d5a838a09a.
import * as api from "#/lib/discord/api.js";
import * as store from "svelte/store";
import QRCode from "qrcode-generator";
import { sleep } from "#/lib/promise.js";

const RemoteAuthGatewayURL = "wss://remote-auth-gateway.discord.gg/?v=2";

type ServerPacket =
  | { readonly op: "_error"; error: any }
  | { readonly op: "hello"; timeout_ms: number; heartbeat_interval: number }
  | { readonly op: "nonce_proof"; encrypted_nonce: string }
  | { readonly op: "pending_remote_init"; fingerprint: string }
  | { readonly op: "pending_ticket"; encrypted_user_payload: string }
  | { readonly op: "pending_login"; ticket: string }
  | { readonly op: "cancel" }
  | { readonly op: "heartbeat_ack" };

type ClientPacket =
  | { readonly op: "heartbeat" }
  | { readonly op: "init"; encoded_public_key: string }
  | { readonly op: "nonce_proof"; proof: string };

class ExpirationError extends Error {
  constructor() {
    super("QR code expired");
  }
}

export type User = {
  id: string;
  discriminator: string;
  avatar: string;
  username: string;
  token: string;
};

function parseUserPayload(payload: string): User {
  const parts = payload.split(":");
  if (parts.length != 4) {
    throw new Error(`invalid user payload: ${payload}`);
  }

  return {
    id: parts[0],
    discriminator: parts[1],
    avatar: parts[2],
    username: parts[3],
    token: "",
  };
}

type Image = `data:image/svg+xml;${string}`;

function generateQR(data: string): Image {
  // Make a QR code generator of type auto and low error correction.
  // https://kazuhikoarase.github.io/qrcode-generator/js/demo/
  const qr = QRCode(0, "L");
  qr.addData(data);
  qr.make();
  console.debug("remoteauth: made QR code for", data, qr);
  const svg = qr.createSvgTag(2, 2);
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

// QROutput is a string that contains a QR code in the form of an SVG.
export type QROutput =
  | {
      readonly ready: true;
      image: Image;
      until: Date;
      user?: Exclude<User, "token">;
    }
  | {
      readonly ready: false;
      error: any;
    };

class RSAKeyPair {
  static async generate(size = 2048): Promise<RSAKeyPair> {
    const pair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
      },
      true,
      ["encrypt", "decrypt"]
    );
    return new RSAKeyPair(pair);
  }

  constructor(public readonly pair: CryptoKeyPair) {}

  // exportPublicKey exports the RSAKeyPair's public key in SPKI format.
  async exportPublicKey(): Promise<ArrayBuffer> {
    return await window.crypto.subtle.exportKey("spki", this.pair.publicKey);
  }

  // decrypt decrypts an RSA-OAEP encrypted message.
  async decrypt(payload: BufferSource): Promise<ArrayBuffer> {
    return await window.crypto.subtle.decrypt({ name: "RSA-OAEP" }, this.pair.privateKey, payload);
  }
}

export class Client {
  private qr_ = store.writable<QROutput>({
    ready: false,
    error: "not started",
  });
  private ws: WebSocket | null = null;
  private packets = store.writable<ServerPacket[]>([]);
  private timeout: number | null = null;
  private heartbeat: number | null = null;
  private heartrate = 0;
  private lastHeartbeat = 0;
  private closed = false;

  public qr = store.readonly(this.qr_);

  constructor(public readonly client: api.Client) {}

  close(normal = true) {
    this.closed = true;
    if (this.ws) {
      this.ws.close(normal ? 1000 : 1001);
      this.ws = null;
      this.packets.set([]);
    }
  }

  async wait(): Promise<User> {
    while (!this.closed) {
      try {
        const user = await this.run();
        this.close();
        return user;
      } catch (err) {
        this.close();
        this.qr_.set({
          ready: false,
          error: err,
        });

        if (err instanceof ExpirationError) {
          await sleep(1000);
          continue;
        }

        console.error("remoteauth: error occured:", err);
        throw err;
      }
    }

    console.error("remoteauth: closed");
    throw new Error("client closed before remote auth could complete");
  }

  private async run(): Promise<User> {
    this.packets.set([]);
    this.ws = this.client.client.websocket(RemoteAuthGatewayURL);

    this.ws.addEventListener("message", (ev: MessageEvent<string>) => {
      const packet = JSON.parse(ev.data);
      if (!packet.op) {
        console.debug("remoteauth: dropping packet", packet);
        return;
      }

      this.onPacket(packet);
      this.packets.update((packets) => [...packets, packet]);
    });

    this.ws.addEventListener("close", (ev) => {
      this.packets.update((packets) => {
        if (this.heartbeat) {
          clearInterval(this.heartbeat);
          this.heartbeat = null;
        }

        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }

        return [{ op: "_error", error: `websocket closed with code ${ev.code}` }];
      });
    });

    // Don't continue until we've received a hello packet, which signals that
    // the server is ready to accept our packets.
    const hello = await this.expectPacket("hello");
    console.debug("remoteauth: received hello from server");

    const key = await RSAKeyPair.generate();
    console.debug("remoteauth: finished generating private key");

    // I don't know crypto shit, but I think this works. I read the
    // documentation and it has ASN.1 DER somewhere in the description, so I'm
    // assuming it's this function.
    const pubkey = await key.exportPublicKey();
    // The Go code uses RawStdEncoding for this.
    const pubkeyBase64 = base64enc(pubkey, { raw: true });
    console.debug(`remoteauth: public key for the resulting key is`, pubkeyBase64);

    this.send({
      op: "init",
      encoded_public_key: pubkeyBase64,
    });

    const nonceProof = await this.expectPacket("nonce_proof");
    console.debug("remoteauth: received nonce proof from server");

    const nonce = await key.decrypt(base64dec(nonceProof.encrypted_nonce));
    console.debug("remoteauth: decrypted proof for nonce");

    // According to the Go code, when we encode our SHA-256, we actually use
    // RawURLEncoding, despite the fact that we send the SPKI public key in
    // RawStdEncoding.
    const proofSHA = await sha256sum(nonce);
    const proof = base64enc(proofSHA, { raw: true, url: true });
    console.debug("remoteauth: sending SHA-256 proof", proof);

    this.send({
      op: "nonce_proof",
      proof,
    });

    const remoteInit = await this.expectPacket("pending_remote_init");
    const fingerprint = remoteInit.fingerprint;
    console.debug(`remoteauth: received remote init with fingerprint`, fingerprint);

    this.qr_.set({
      ready: true,
      image: generateQR("https://discordapp.com/ra/" + fingerprint),
      until: new Date(Date.now() + hello.timeout_ms),
    });

    const ticket = await this.expectPacket("pending_ticket", hello.timeout_ms);
    console.debug(`remoteauth: received pending ticket`);

    const userPayload = await key.decrypt(base64dec(ticket.encrypted_user_payload));
    const user = parseUserPayload(utf8Buffer(userPayload));
    console.debug(`remoteauth: decrypted user payload`);

    this.qr_.update((qr) => ({ ...qr, user }));

    const loginTicket = await this.expectPacket("pending_login", hello.timeout_ms);

    const loginResp = await this.client.do<api.RemoteAuthLogin>({
      method: "POST",
      path: "/users/@me/remote-auth/login",
      ticket: loginTicket.ticket,
    });

    const encryptedToken = base64dec(loginResp.encrypted_token);
    const token = await key.decrypt(encryptedToken);

    user.token = utf8Buffer(token);
    return user;
  }

  private send(packet: ClientPacket) {
    if (!this.ws) {
      throw new Error("cannot send to closed websocket");
    }
    if (this.ws.readyState != WebSocket.OPEN) {
      throw new Error("cannot send to websocket in state " + this.ws.readyState);
    }
    this.ws.send(JSON.stringify(packet));
  }

  private async expectPacket<
    OpType extends ServerPacket["op"],
    Packet extends Extract<ServerPacket, { readonly op: OpType }>
  >(op: OpType, timeout = 10000): Promise<Packet> {
    return new Promise((resolve, reject) => {
      let unsub: store.Unsubscriber;
      const timeoutHandler = setTimeout(() => {
        unsub();
        reject(new Error(`timed out waiting for packet ${op}`));
      }, timeout);

      unsub = this.packets.subscribe((packets) => {
        const packetIx = packets.findIndex((p) => p.op == op || p.op == "_error");
        if (packetIx != -1) {
          clearTimeout(timeoutHandler);
          unsub();

          const packet = packets.splice(packetIx, 1)[0];
          switch (packet.op) {
            case "_error":
              reject(packet.error);
              break;
            case op:
              resolve(packet as Packet);
              break;
          }
        }
      });
    });
  }

  private onPacket(packet: ServerPacket) {
    switch (packet.op) {
      case "hello": {
        if (this.heartbeat || this.timeout) {
          throw new Error("received hello packet while already initialized");
        }

        this.heartrate = packet.heartbeat_interval;
        this.heartbeat = window.setInterval(() => {
          this.lastHeartbeat = Date.now();
          this.send({ op: "heartbeat" });
        }, this.heartrate);

        this.timeout = window.setTimeout(() => {
          if (this.ws) {
            this.ws.close();
            throw new ExpirationError();
          }
        }, packet.timeout_ms);

        break;
      }
      case "heartbeat_ack": {
        const now = Date.now();
        if (now - this.lastHeartbeat > this.heartrate * 2) {
          if (this.ws) {
            this.ws.close();
            throw new Error("timed out waiting for heartbeat ack");
          }
          break;
        }

        this.lastHeartbeat = now;
        break;
      }
      case "cancel": {
        if (this.ws) {
          this.ws.close();
          throw new Error("remote auth cancelled by server");
        }
      }
    }
  }
}

// Herein lies JavaScript crypto API hell. I don't know what I'm doing, but
// this seems to work.

function utf8Buffer(buffer: BufferSource): string {
  return new TextDecoder("utf-8").decode(buffer);
}

function base64dec(b64: string): ArrayBuffer {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}

function base64enc(
  buffer: ArrayBuffer,
  { raw, url }: { raw?: boolean; url?: boolean } = {}
): string {
  let b64s = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  if (url) b64s = b64s.replaceAll("+", "-").replaceAll("/", "_");
  if (raw) b64s = b64s.replaceAll("=", "");
  return b64s;
}

// sha256sum returns the SHA256 hash of the given data in base64.
async function sha256sum(data: BufferSource): Promise<ArrayBuffer> {
  return await crypto.subtle.digest("SHA-256", data);
}

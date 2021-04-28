import { Server, Socket } from "socket.io";
import { userSession } from "../rest/server";
import http from "http";
import { ServerOptions } from "../app";
import { authSocketUser } from "./authenticate";
import { registerSocketEvents } from "./events/register";

/**
 * Creates a socket.io websocket server
 * @param server - Server to register te socket-server on
 * @param options - Port and Host options to run socket server on
 */
export function createSocketServer(server: http.Server, options: ServerOptions) {
  const io = new Server(server, {
    cors: {
      origin: options.clientUrl,
      methods: ["GET", "POST"],
      allowedHeaders: [options.clientUrl, "user"],
      credentials: true,
    },
    pingTimeout: 500,
    transports: ['websocket']
  })
  io.use((socket: any, next: any) => userSession(socket.request, {} as any, next))
  io.on('connection', async (socket: Socket) => {
    io.use((socket: Socket, next: any) => authSocketUser(socket, io, next))
    registerSocketEvents(io, socket)
    socket.emit('connected')
  })
  return io
}
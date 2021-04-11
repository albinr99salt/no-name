import {io, Socket} from "socket.io-client";
import type {CardResponse, GameSocketResponse, UserResponse} from "./ResponseTypes";
import {CardState} from "./ResponseTypes";

enum Events {
  GET_GAME = 'get-game',
  JOIN = 'join',
  START = 'start',
  PLAY_CARD = 'play-card',
  FLIP_CARD = 'flip-card',
  LEAVE_GAME = 'leave-game',
}

export class SocketClient {
  private baseUrl = 'http://localhost:5000'
  socket: Socket

  game: GameSocketResponse
  currentUser: UserResponse

  constructor(user: UserResponse) {
    this.currentUser = user
  }

  connect = async (rerenderCb: CallableFunction): Promise<void> => {
    this.socket = io(this.baseUrl, {
      withCredentials: true,
      transports: ['websocket'],
      timeout: 500,
      reconnection: false,
      upgrade: true,
    })
    // socket event listeners
    this.socket.on('update', (game: GameSocketResponse) => {
      if(this.updateGameState(game)) {
        rerenderCb()
      }
    })
    this.socket.on('disconnect', () => {
      rerenderCb('disconnect')
    })
    this.socket.on('connection_error', (err: string) => {
      console.error(err)
    })
    return new Promise(resolve => {
      this.socket.on('connected', () => {
        resolve()
      })
    })
  }

  getGame = () => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.GET_GAME)
  }

  joinGame = (key: string = this.game.key) => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(!key && !this.game.key) throw new Error('No gameKey specified.')
    this.socket.emit(Events.JOIN, key)
  }

  startGame = () => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.START)
  }

  playCard = (card: CardResponse) => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(!this.currentUser.hasPlayed) {
      this.socket.emit(Events.PLAY_CARD, card.id)
    }
  }

  flipCard = (card: CardResponse) => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(card.state === CardState.PLAYED_SHOW) throw new Error('Card is already flipped')
    this.socket.emit(Events.FLIP_CARD, card.id)
  }

  leaveGame = () => {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.LEAVE_GAME)
  }

  private updateGameState = (game: GameSocketResponse) => {
    console.log('got update')
    // a type of cache to not re-update the state if the new state is the same as current
    if(JSON.stringify(this.game) === JSON.stringify(game)) return false
    console.log('game: ', game)
    this.currentUser = game.users.find(user => user.id === this.currentUser.id)
    this.game = game
    return true
  }
}
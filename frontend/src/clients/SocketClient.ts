import {io, Socket} from "socket.io-client";
import type {CardResponse, GameSocketResponse, UserResponse} from "./ResponseTypes";
import {CardState} from "./ResponseTypes";
import { HandleError } from "../utils/decorator";
import autoBind from "auto-bind";
// @ts-ignore
import * as process from "process";

enum Events {
  GET_GAME = 'get-game',
  JOIN = 'join',
  START = 'start',
  PLAY_CARD = 'play-card',
  FLIP_CARD = 'flip-card',
  VOTE_CARD = 'vote-card',
  LEAVE_GAME = 'leave-game',
}

export class SocketClient {
  private readonly baseUrl: string = process.env.API_BASE_URL
  socket: Socket

  game: GameSocketResponse
  currentUser: UserResponse

  constructor(user: UserResponse) {
    this.currentUser = user
    autoBind(this)
  }

  public connect = async (rerenderCb: CallableFunction): Promise<void> => {
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
      console.error('connection error: ', err)
    })
    this.socket.on('server_error', (err: string) => {
      console.error('server_error: ', err)
    })
    this.socket.on('rule_error', (err: string) => {
      console.error('rule_error: ', err)
    })
    return new Promise(resolve => {
      this.socket.on('connected', () => {
        resolve()
      })
    })
  }

  private get allPlayers() {
    return this.game.users.filter(user => !user.cardWizz)
  }

  private get allUsersPlayed() {
    return this.allPlayers.every(user => user.hasPlayed)
  }

  private updateGameState = (game: GameSocketResponse) => {
    // a type of cache to not re-update the state if the new state is the same as current
    // todo: This might not be needed anymore since we've fixed the issues with the socket
    if(JSON.stringify(this.game) === JSON.stringify(game)) return false
    this.currentUser = game.users.find(user => user.id === this.currentUser.id)
    this.game = game
    return true
  }

  @HandleError
  public getGame() {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.GET_GAME)
  }

  @HandleError
  public joinGame(key: string = this.game.key) {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(!key && !this.game.key) throw new Error('No gameKey specified.')
    this.socket.emit(Events.JOIN, key)
  }

  @HandleError
  public startGame() {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.START)
  }

  @HandleError
  public playCard(card: CardResponse) {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(!this.currentUser.hasPlayed) {
      this.socket.emit(Events.PLAY_CARD, card.id)
    }
  }

  @HandleError
  public flipCard(card: CardResponse) {
    if(!this.socket) {
      throw new Error('InGameClient not connected to socket.')
    }
    if(card.state === CardState.PLAYED_SHOW) {
      throw new Error('Card is already flipped')
    }
    if(!this.allUsersPlayed) {
      throw new Error('All user must play before flipping')
    }
    this.socket.emit(Events.FLIP_CARD, card.id)
  }

  @HandleError
  public voteCard(card: CardResponse) {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    if(!this.allUsersPlayed) {
      throw new Error('All user must play before voting')
    }
    const allCards = this.allPlayers.flatMap(user => user.cards)
    if(allCards.some(card => card.state === CardState.PLAYED_HIDDEN)) {
      throw new Error('All cards must be flipped before vote')
    }
    this.socket.emit(Events.VOTE_CARD, card.id)
  }

  @HandleError
  public leaveGame() {
    if(!this.socket) throw new Error('InGameClient not connected to socket.')
    this.socket.emit(Events.LEAVE_GAME)
  }
}

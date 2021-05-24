import {BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn} from "typeorm"
import {User} from "../../user/models/User"
import {GameRound} from "./GameRound"
import {createWhiteCardRef, getUnusedBlackCard, getUnusedWhiteCards} from "../../card/services";
import {CardState, WhiteCardRef} from "../../card/models/WhiteCardRef";
import {BlackCard} from "../../card/models/BlackCard";
import {NotFoundError} from "../../error";

@Entity()

export class Game extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  key: string

  @Column({name: 'play_cards'})
  playCards: number

  @Column()
  rounds: number

  @Column({name: 'card_deck'})
  cardDeck: string

  @Column({name: 'private_lobby'})
  privateLobby: boolean

  @Column({name: 'player_limit'})
  playerLimit: number

  @Column({default: false})
  started: boolean

  @Column({default: 1})
  current_round: number

  @Column({name: 'host_user_id_fk'})
  hostUserId: number

  @OneToMany(type => User, user => user.game, {
    onDelete: "CASCADE",
  })
  @JoinColumn({name: 'user_game_session_key'})
  users: User[]

  @OneToOne(type => GameRound)
  @JoinColumn([
    {name: 'key', referencedColumnName: 'game_key'},
    {name: 'current_round', referencedColumnName: 'round_number'},
  ])
  round: GameRound

  @ManyToOne(type => BlackCard)
  @JoinColumn({name: 'black_card_id_fk'})
  blackCard: BlackCard

  @Column({nullable: true})
  black_card_id_fk: number

  /**
   * @private currentUserId
   * Holds the id of what to be considered the currentUser
   * of a game. The currentUser is the user amongst all the game's
   * user's that will be considered the active user in a
   * particular request.
   *
   * Needed
   */
  private currentUserId: number

  /**
   * Set the currentUser for the Game instance
   * @param user
   */
  public set currentUser(user: User) {
    this.currentUserId = user.id
  }

  /**
   * Returns the User instance for the currentUserId private
   */
  public get currentUser(): User {
    const user = this.users.find(user => user.id === this.currentUserId)
    if(!user) {
      throw new Error('CurrentUser does not exist on game')
    }
    return user
  }

  /**
   * Gets all players except the cardWizz
   */
  public get allPlayers(): User[] {
    return this.users.filter(user => !user.isCardWizz)
  }

  /**
   * Gets all cards from all players except cardWizz
   */
  public get allPlayerCards(): WhiteCardRef[] {
    return this.allPlayers.flatMap(user => user.cards)
  }

  /**
   * Find card on game that match supplied cardId
   *
   * Returns a WhiteCardRef on success
   * @param cardId
   */
  public findCard = (cardId: number): WhiteCardRef => {
    const card = this.users.flatMap(user => user.cards).find(card => card.id === cardId)
    if (!card) {
      throw new NotFoundError(`Could not find <WhiteCardRef> with id ${cardId}`)
    }
    return card
  }

  /**
   * Find user on game that match supplied userId
   *
   * Returns a User on success
   * @param userId
   */
  public findUser = (userId: number): User => {
    const user = this.users.find(user => user.id === userId)
    if (!user) {
      throw new NotFoundError(`Could not find <User> with id ${userId}`)
    }
    return user
  }

  /**
   * Add a User to the game
   * @param user
   */
  public addPlayer = (user: User): void => {
    if(this.users.some(u => u.id === user.id)) return
    this.users.push(user)
  }

  /**
   * Removes a user from the game
   * @param user
   */
  public removePlayer = async (user: User): Promise<void> => {
    this.users = this.users.filter((u) => u.id !== user.id)
    user.game_fk = null
    user.hasPlayed = false
    user.score = 0
    await user.save()
    return
  }

  /**
   * Assign a cardwizz for each round in the game
   * Makes sure that there is a new cardwizz for every round.
   */
  public assingCardWizz = async (): Promise<void> => {
    const rounds = await GameRound.find({game_key: this.key})
    let userIdx = 0
    for (const round of rounds) {
      if (userIdx == this.users.length) {
        userIdx = 0
      }
      round.cardWizz = this.users[userIdx]
      round.card_wizz_user_id_fk = this.users[userIdx].id
      userIdx++
    }
    await Promise.all(rounds.map(r => r.save()))
  }

  /**
   * Assign new cards to all users in the game.
   * Makes sure to assign that many cards so that
   * each user has as many cards as the card limit
   * allows.
   */
  public handOutCards = async (): Promise<void> => {
    for(const user of this.users) {
      const cardOnHand = user.cards.filter((card) => card.state === CardState.HAND).length
      const cardDelta = this.playCards - cardOnHand
      const whiteCards = await getUnusedWhiteCards(this.key, cardDelta)
      for (const wc of whiteCards) {
        const wcr = await createWhiteCardRef({
          user,
          whiteCard: wc,
          gameKey: this.key,
          state: CardState.HAND,
        })
        user.cards.push(wcr)
      }
    }
    console.log('done')
  }

  /**
   * Retrieves and sets a new black card for the Game
   */
  public newBlackCard = async (): Promise<void> => {
    this.blackCard = await getUnusedBlackCard(this.key)
  }
}

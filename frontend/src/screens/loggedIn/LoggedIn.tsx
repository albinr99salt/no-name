import React, {useEffect, useState} from "react";

import {useDispatch, useSelector} from "react-redux";
import {
  ReduxState,
  setError,
  updateUser,
} from "../../redux/redux";
import User from "../../clients/User";
import Spinner from "../../components/Spinner";
import RestClient from "../../clients/RestClient";
import Game from "../../clients/Game";
import {GameResponse} from "../../clients/ResponseTypes";
import MenuAppBar from "../../components/MenuAppBar";
import Home from "./Home";
import SetupGame from "./SetupGame";
import InGame from "./inGame/InGame";

const LoggedIn = () => {
  const [screen, setScreen] = useState<'home' | 'create-game'>('home');
  const [loading, setLoading] = useState(true);
  const [hasGame, setHasGame] = useState(false);
  const user = useSelector<ReduxState, User | null>((state) => state.user);
  const game = useSelector<ReduxState, Game | null>((state) => state.game);
  const rest = new RestClient();
  const dispatch = useDispatch();

  if (!user) {
    dispatch(setError('You are not logged in'))
  }
  const checkForGame = async () => {
    try {
      const game = await rest.makeRequest<GameResponse>({method: 'get', route: 'game'});
      return !!game.key;
    } catch (err) {
      return false;
    }
  }
  const handleLogout = async () => {
    try {
      console.log('log out request');
      await rest.makeRequest({method: 'post', route: 'user', action: 'logout'});
      console.log('dispatch null user');
      dispatch(updateUser(null));
      console.log('user', user);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    (async () => {
      const userHaveGame = await checkForGame();
      if (!userHaveGame) {
        setLoading(false);
        return;
      }
      setHasGame(true);
    })()
  }, [])

  if (hasGame || game) {
    return <InGame
      handleLogout={handleLogout}
      setLoggedInScreen={setScreen}
      setHasGame={setHasGame}
      setLoading={setLoading}
    />
  }

  if (loading) {
    return <Spinner/>
  }

  const renderScreen = () => {
    switch (screen) {
      case 'home':
        return <Home setScreen={setScreen}/>
      case 'create-game':
        return <SetupGame setScreen={setScreen}/>
    }
  }

  return (
    <React.Fragment>
      <MenuAppBar user={user} logout={handleLogout}/>
      {renderScreen()}
    </React.Fragment>
  );
}

export default LoggedIn
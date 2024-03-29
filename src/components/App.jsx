import React from 'react';
import Footer from './Footer.jsx'
import Board from './Board.jsx';
import WebSocketService from './WebSocketService.js';
import './App.scss';
import MESSAGE_TYPES from '../types';

const APP_VIEW = {
  MAIN_MENU: 0,
  CREATE_ROOM_MENU: 1,
  JOIN_ROOM_MENU: 2,
  GAME: 3,
  RULES: 4
};

const GAME_MODE = {
  LOCAL: 0,
  ONLINE: 1
};

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      player: 'x',
      turn: 'x',
      currentBoard: null,
      boards: Array(9).fill(Array(9).fill(null)),
      boardWinners: Array(9).fill({ winner: null, winningLine: null }),
      gameWinner: null,
      gameWinningLine: null,
      appView: APP_VIEW.MAIN_MENU,
      gameMode: null,
      roomCode: null,
      roomCodeInput: '',
      joiningRoom: false,
      error: null,
      errorClearTimer: null,
      lines:
        [[0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]]
    }
    this.squareEls = Array(9).fill(Array(9).fill(null));
    this.boardEl = null;
    this.webSocketService = new WebSocketService();
    this.webSocketService.initialize(this.webSocketMessageHandler.bind(this));
  }

  reset() {
    this.setState({
      turn: 'x',
      player: 'x',
      currentBoard: null,
      boards: Array(9).fill(Array(9).fill(null)),
      boardWinners: Array(9).fill({ winner: null, winningLine: null }),
      gameWinner: null,
      gameWinningLine: null,
      joiningRoom: false,
      error: null,
      errorClearTimer: null
    })
  }

  isFull(board) {
    for (var i = 0; i <= 8; ++i) {
      if (board[i] === null) {
        return false;
      }
    }
    return true;
  }

  didWinBoard(board, player) {
    for (var i = 0; i < this.state.lines.length; ++i) {
      for (var j = 0; j <= 2; ++j) {
        if (board[this.state.lines[i][j]] !== player) {
          break;
        }
        if (j === 2) {
          return this.state.lines[i];
        }
      }
    }
    return null;
  }

  didWin(boardWinners, player) {
    for (var i = 0; i < this.state.lines.length; ++i) {
      for (var j = 0; j <= 2; ++j) {
        if (boardWinners[this.state.lines[i][j]].winner !== player) {
          break;
        }
        if (j === 2) {
          return this.state.lines[i];
        }
      }
    }
    return null;
  }

  registerSquare(b, i, el) {
    let squares = this.squareEls.map(a => Object.assign({}, a));
    squares[b][i] = el;
    this.squareEls = squares;
  }

  registerBoard(el) {
    this.boardEl = el;
  }

  handleClick(b, i) {
    if (this.state.player !== this.state.turn)
      return;
    if (this.state.gameWinner)
      return;
    if (this.state.currentBoard !== null && b !== this.state.currentBoard)
      return;
    if (this.state.boards[b][i])
      return;

    if (this.state.gameMode === GAME_MODE.ONLINE) {
      this.webSocketService.webSocket.send(JSON.stringify({
        type: MESSAGE_TYPES.SEND_MOVE,
        body: {
          player: this.state.player,
          b: b,
          i: i,
          roomCode: this.state.roomCode
        }
      }));
    }

    if (this.state.gameMode === GAME_MODE.LOCAL) {
      this.setState({
        player: this.oppositeSymbol(this.state.player)
      });
    }

    this.setState({
      turn: this.oppositeSymbol(this.state.turn)
    });

    this.processMove(this.state.player, b, i);
  }

  oppositeSymbol(symbol) {
    return symbol === 'x' ? 'o' : 'x';
  }

  processMove(player, b, i) {
    const boards = this.state.boards.map(a => Object.assign({}, a));
    boards[b][i] = player;

    let boardWinners = this.state.boardWinners;
    let gameWinner = null;
    let gameWinningLine = null;
    if (!boardWinners[b].winner) {
      const boardWinningLine = this.didWinBoard(boards[b], player);
      if (boardWinningLine) {
        boardWinners[b] = { winner: player, winningLine: boardWinningLine };
        gameWinningLine = this.didWin(boardWinners, player);
        if (gameWinningLine) {
          gameWinner = player;
        }
      }
    }

    let currentBoard = i;
    if (gameWinner || this.isFull(boards[i])) {
      currentBoard = null;
    }

    this.setState({
      gameWinner: gameWinner,
      gameWinningLine: gameWinningLine,
      boards: boards,
      currentBoard: currentBoard,
      boardWinners: boardWinners
    });
  }

  startLocalGame() {
    this.setState({
      appView: APP_VIEW.GAME,
      gameMode: GAME_MODE.LOCAL
    });
  }

  webSocketMessageHandler(message) {
    switch (message.type) {
      case MESSAGE_TYPES.ROOM_CREATED: {
        return this.handleRoomCreated(message);
      }
      case MESSAGE_TYPES.ASSIGN_SYMBOL_AND_START_GAME: {
        return this.handleGameStart(message);
      }
      case MESSAGE_TYPES.RECEIVE_MOVE: {
        return this.handleReceiveMove(message);
      }
      case MESSAGE_TYPES.ERROR: {
        return this.handleErrorMessages(message);
      }
    }
  }

  handleErrorMessages(message) {
    this.displayErrorMessages(message);

    switch (message.body.subType) {
      case MESSAGE_TYPES.JOIN_ROOM: {
        return this.handleJoinRoomFailed();
      }
    }
  }

  displayErrorMessages(message) {
    if (this.state.errorClearTimer) {
      clearTimeout(this.state.errorClearTimer);
    }

    let clearTimer = setTimeout(() => {
      this.setState({
        error: null,
        errorClearTimer: null
      });
    }, 5 * 1000);

    this.setState({
      error: message.body.message,
      errorClearTimer: clearTimer
    });
  }

  handleJoinRoomFailed() {
    this.setState({
      joiningRoom: false
    });
  }

  handleGameStart(message) {
    this.setState({
      player: message.body.symbol,
      roomCode: message.body.roomCode,
      appView: APP_VIEW.GAME,
      roomCodeInput: ''
    })
  }

  handleReceiveMove(message) {
    this.setState({
      turn: this.oppositeSymbol(this.state.turn)
    });
    this.processMove(message.body.player, message.body.b, message.body.i);
  }

  handleRoomCreated(message) {
    this.setState({ roomCode: message.body.roomCode });
  }

  async createOnlineRoom() {
    this.setState({
      appView: APP_VIEW.CREATE_ROOM_MENU,
      gameMode: GAME_MODE.ONLINE,
      roomCode: null
    });
    await this.webSocketService.waitForConnection();
    this.webSocketService.webSocket.send(JSON.stringify({ type: MESSAGE_TYPES.CREATE_ROOM }));
    // TODO: onclose -> go to mainmenu
  }

  joinOnlineRoom() {
    this.setState({
      appView: APP_VIEW.JOIN_ROOM_MENU,
      gameMode: GAME_MODE.ONLINE
    });
  }

  viewRules() {
    this.setState({
      appView: APP_VIEW.RULES,
    });
  }

  async joinWithRoomCode() {
    this.setState({
      joiningRoom: true
    });

    setTimeout(() => {
      this.setState({
        joiningRoom: false
      })
    }, 5 * 1000);

    await this.webSocketService.waitForConnection();

    this.webSocketService.webSocket.send(JSON.stringify({
      type: MESSAGE_TYPES.JOIN_ROOM,
      body: { roomCode: this.state.roomCodeInput }
    }));
  }

  mainMenu() {
    this.setState({
      appView: APP_VIEW.MAIN_MENU
    });
  }

  quit() {
    // TODO: leave room if online
    this.reset();
    this.setState({
      appView: APP_VIEW.MAIN_MENU
    });
  }

  componentWillMount() {
    window.addEventListener("resize", () => this.forceUpdate());
  }

  componentWillUnmount() {
    window.removeEventListener("resize", () => this.forceUpdate());
  }

  render() {
    const board = Array(3).fill(null).map((v, r) => {
      const row = Array(3).fill(null).map((v, c) => {
        const boardNum = r * 3 + c;
        let isCurrent = false;
        let noCurrent = false;
        if (boardNum === this.state.currentBoard) {
          isCurrent = true;
        }
        if (this.state.currentBoard === null) {
          noCurrent = true;
        }
        return <Board
          key={boardNum}
          gameWinningLine={this.state.gameWinningLine}
          gameWinner={this.state.gameWinner}
          isCurrent={isCurrent}
          noCurrent={noCurrent}
          boardNum={boardNum}
          boardValue={this.state.boards[boardNum]}
          onClick={(i) => this.handleClick(boardNum, i)}
          registerSquare={(i, el) => this.registerSquare(boardNum, i, el)} />;
      });
      return (
        <div key={`row ${r}`}>
          {row}
          <div className="row"></div>
        </div>
      );
    });

    const winLines = this.state.boardWinners.map((v, i) => {
      if (v.winner !== null) {

        var origin = this.boardEl.getBoundingClientRect();

        var firstSquare = this.squareEls[i][v.winningLine[0]].getBoundingClientRect();
        var lastSquare = this.squareEls[i][v.winningLine[2]].getBoundingClientRect();
        var x1 = firstSquare.left + firstSquare.width / 2 - origin.left;
        var y1 = firstSquare.top + firstSquare.height / 2 - origin.top;
        var x2 = lastSquare.left + lastSquare.width / 2 - origin.left;
        var y2 = lastSquare.top + lastSquare.height / 2 - origin.top;

        var winner = v.winner === 'x' ? 'xline' : 'oline';
        var classes = `${winner}`

        return <line
          key={`line ${i}`}
          className={classes}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2} />
      }
      return null;
    })


    const gameOverText1 = () => {
      if (this.state.gameMode === GAME_MODE.LOCAL) {
        return `${this.state.gameWinner.toUpperCase()} wins!`;
      }

      return `You ${this.state.gameWinner === this.state.player ? 'won!' : 'lost...'}`;
    }

    const gameOverText2 = () => {
      if (this.state.gameMode === GAME_MODE.LOCAL || this.state.gameWinner === this.state.player) {
        return (
          <span>
            {this.oppositeSymbol(this.state.gameWinner).toUpperCase()} =
            <div className="svg-placeholder">
              <div id="sad" className={this.oppositeSymbol(this.state.gameWinner)}></div>
            </div>
          </span>
        );
      }

      return (
        <span>
          {this.oppositeSymbol(this.state.player).toUpperCase()} =
          <div className="svg-placeholder">
            <div id="happy" className={this.oppositeSymbol(this.state.player)}></div>
          </div>
        </span>
      );
    }

    const gameOverText1Class = () => {
      if (this.state.gameMode === GAME_MODE.LOCAL) {
        return this.state.gameWinner;
      }

      return this.state.player;
    };

    const gameOverText2Class = () => {
      if (this.state.gameMode === GAME_MODE.LOCAL) {
        return this.oppositeSymbol(this.state.gameWinner);
      }

      return this.oppositeSymbol(this.state.player);
    };


    const gameWinner = this.state.gameWinner !== null && (
      <div id="winner">
        <span className={gameOverText1Class()}>{gameOverText1()}</span>
        <br />
        <span className={gameOverText2Class()}>{gameOverText2()}</span>
      </div>);

    const renderAppView = () => {
      switch (this.state.appView) {
        case APP_VIEW.GAME:
          return renderGame();
        case APP_VIEW.MAIN_MENU:
          return mainMenu;
        case APP_VIEW.CREATE_ROOM_MENU:
          return createRoomMenu;
        case APP_VIEW.JOIN_ROOM_MENU:
          return joinRoomMenu;
        case APP_VIEW.RULES:
          return rules;
      }
    }

    const renderGame = () => {
      return this.state.gameMode === GAME_MODE.ONLINE ? onlineGame : localGame;
    }

    const sharedGameContent = (
      <div>
        <div id="board" ref={el => this.registerBoard(el)}>
          {board}
          <svg id="line-canvas">
            {winLines}
          </svg>

        </div>
        {gameWinner}
      </div>
    );

    const topLeftIndicatorClasses = `top-left indicator x`;
    const topRightIndicatorClasses = `top-right indicator o`;

    const onlineGame = (<div id="game">
      {this.state.gameWinner == null && (<div>
        <div className={topLeftIndicatorClasses}>
          X
          <p>
            {this.state.turn === 'x' && this.state.player === 'x' ? '(your turn)' : null}
            {this.state.turn === 'x' && this.state.player === 'o' ? '(their turn)' : null}
          </p>
        </div>
        <div className={topRightIndicatorClasses}>
          O
          <p>
            {this.state.turn === 'o' && this.state.player === 'o' ? '(your turn)' : null}
            {this.state.turn === 'o' && this.state.player === 'x' ? '(their turn)' : null}
          </p>
        </div>
      </div>)}
      {sharedGameContent}
      <button className="text-button corner-button" id="quit" onClick={() => this.quit()}>quit?</button>
    </div>);

    const localTopRightIndicatorClasses = `top-right indicator ${this.state.turn}`;

    const localGame = (<div id="game">
      <div hidden={this.state.gameWinner !== null} className={localTopRightIndicatorClasses}>
        {this.state.turn.toUpperCase()}'s turn
      </div>
      {sharedGameContent}
      <button className="text-button corner-button" id="quit" onClick={() => this.quit()}>quit?</button>
    </div>);

    const mainMenu =
      (<div id="main-menu">
        <button id="local-play" className="text-button" onClick={() => this.startLocalGame()}>local play</button>
        <button className="text-button" onClick={() => this.createOnlineRoom()}>create room</button>
        <button className="text-button" onClick={() => this.joinOnlineRoom()}>join room</button>
        <button className="text-button" onClick={() => this.viewRules()}>how to play</button>
      </div>);

    const createRoomMenu =
      (<div id="create-room-menu">
        <h3>room code:</h3>
        <h4 className="room-code">
          {this.state.roomCode === null && (<div className="loader"></div>)}
          {this.state.roomCode}
        </h4>
        <p>{this.state.roomCode === null ? 'Generating room code...' : 'Waiting for your friend to join...'}</p>
        <button className="text-button corner-button" id="back-to-main-menu" onClick={() => this.mainMenu()}>back</button>
      </div>);

    const handleRoomCodeInput = (event) => {
      this.setState({
        roomCodeInput: event.target.value.trim().toUpperCase()
      });
    }

    const joinRoomMenu =
      (<div id="join-room-menu">
        <h3>room code:</h3>
        <form>
          <input className="room-code" type="text"
            maxLength="6"
            placeholder="??????"
            value={this.state.roomCodeInput}
            onInput={handleRoomCodeInput} />
          <button type="submit" className="text-button" disabled={this.state.joiningRoom || this.state.roomCodeInput.length < 6} id="join-button" onClick={() => this.joinWithRoomCode()}>
            {this.state.joiningRoom ? <div className="loader"></div> : 'join'}
          </button>
        </form>
        <button className="text-button corner-button" id="back-to-main-menu" onClick={() => this.mainMenu()}>back</button>
      </div>);

    const rules = (
      <div id="rules">
        <h3>how to play</h3>
        <ul>
          <li>Players take turns, just like regular tic-tac-toe.</li>
          <li>Each board is won just like regular tic-tac-toe.</li>
          <li>But when a player claims a square, their opponent has to play in the corresponding board.</li>
          <li>Win 3 boards in a row to win Tic-Metac-Toe!</li>
        </ul>
        <button className="text-button corner-button" id="back-to-main-menu" onClick={() => this.mainMenu()}>back</button>
      </div>
    );

    return (
      <div id="container">
        <div id="app">
          <div id="whiteboard">
            <h2>Tic Metac Toe</h2>
            {renderAppView()}
            <div className="error-queue">{this.state.error}</div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }
}

export default App;
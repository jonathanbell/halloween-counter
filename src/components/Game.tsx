import { useGame } from '../hooks/useGame';

export const Game = () => {
  const {
    isConnected,
    isPlaying,
    currentZombies,
    score,
    finalScore,
    connect,
    startGame,
    hitZombie,
    endGame,
  } = useGame({ url: 'ws://localhost:8080/ws/game' });

  const handleConnect = () => {
    connect();
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleHit = (zombieId: string) => {
    hitZombie(zombieId);
  };

  const handleEndGame = () => {
    endGame();
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', backgroundColor: '#1a1a1a', color: '#fff', minHeight: '100vh' }}>
      <h1>Whack-a-Zombie Game</h1>

      <div style={{ marginBottom: '20px' }}>
        {!isConnected && (
          <button onClick={handleConnect} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Connect to Game
          </button>
        )}

        {isConnected && !isPlaying && finalScore === null && (
          <button onClick={handleStartGame} style={{ padding: '10px 20px', fontSize: '16px' }}>
            Start Game
          </button>
        )}

        {isPlaying && (
          <>
            <div style={{ marginBottom: '10px', fontSize: '24px' }}>
              Score: <strong>{score}</strong>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              {currentZombies.map((zombie) => (
                <button
                  key={zombie.id}
                  onClick={() => handleHit(zombie.id)}
                  style={{
                    padding: '20px',
                    fontSize: '20px',
                    backgroundColor: zombie.direction === 0 ? '#ff6b6b' : '#4ecdc4',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  {zombie.direction === 0 ? '← LEFT' : 'RIGHT →'} Zombie
                </button>
              ))}
            </div>

            <button onClick={handleEndGame} style={{ padding: '10px 20px', fontSize: '16px' }}>
              End Game
            </button>
          </>
        )}

        {finalScore !== null && (
          <div style={{ marginTop: '20px' }}>
            <h2>Game Over!</h2>
            <p>Final Score: {finalScore}</p>
            <button onClick={handleStartGame} style={{ padding: '10px 20px', fontSize: '16px' }}>
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

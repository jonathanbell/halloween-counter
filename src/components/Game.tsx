import { useGame } from '../hooks/useGame';

// Canvas-generated share image (final score + hashtag)
function shareScore(score: number): void {
  const hashtag = '#HalloweenCandyCounter2026';
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 500;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // backdrop
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, 800, 500);

  // decorations
  ctx.fillStyle = '#9b59b6';
  ctx.font = 'bold 32px monospace';
  ctx.fillText('🧟 Whack-a-Zombie 🎮', 80, 80);

  // score + message
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 120px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(String(score), 400, 280);

  ctx.fillStyle = '#e67e22';
  ctx.font = 'bold 24px monospace';
  ctx.fillText(hashtag, 400, 360);

  const url = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.href = url;
  link.download = `whack-a-zombie-score-${score}.png`;
  link.click();
}

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
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleStartGame} style={{ padding: '10px 20px', fontSize: '16px' }}>
              Play Again
            </button>
            <button
              onClick={() => shareScore(finalScore)}
              style={{ padding: '10px 20px', fontSize: '16px', background: '#e67e22', color: '#fff', border: 'none', borderRadius: '6px' }}
            >
              📸 Share Score
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

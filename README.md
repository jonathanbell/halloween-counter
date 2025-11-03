# Halloween Trick-or-Treater Counter 🎃

A spooky, interactive counter application with real-time remote control capabilities. Project onto your garage door via an HDMI capable projector for a fun, animated display that tracks visitors and candy inventory with zombie-themed animations. Control the counter from any mobile device on your network!

## Quick Start

### Installation

```bash
git clone https://github.com/jonathanbell/halloween-counter.git
cd halloween-counter

npm install
```

### Running the Application

```bash
# Production mode (recommended)
npm run start     # Builds and starts the SSE server on port 3000

# Development mode
npm run dev       # Vite dev server (no SSE features)
npm run dev:all   # Build and run SSE server for development
```

### Access Points

- **Main Display**: `http://localhost:3000` (connect to projector)
- **Remote Control**: `http://localhost:3000/remote` (mobile devices)
- **Settings**: `http://localhost:3000/settings` (configure candy and trick-o-treater counts)

## Features

- 🎃 **Real-time Synchronization**: All devices stay in sync via Server-Sent Events (SSE)
- 📱 **Mobile Remote Control**: Increment counter from any phone on your network
- 🧟 **Animated Zombies**: Rive-powered animations that react to visitor count
- 📊 **Live Statistics**: Track visitors per hour, average time between visits
- 🍬 **Candy Tracking**: Monitor remaining candy with visual progress bar
- 🖥️ **Projector Ready**: Full-screen mode optimized for garage door projection

## Usage

### Basic Operation

1. **Start the server**: Run `npm run start`
2. **Open main display**: Navigate to `http://localhost:3000`
3. **Connect mobile devices**: Share your IP address for remote access
4. **View fullscreen**: Press `Ctrl+F` on the main display
5. **Count visitors**: Press spacebar or use mobile remote

### Network Setup

1. **Find your IP address**:

   ```bash
   # macOS/Linux
   ifconfig | grep "inet "

   # Windows
   ipconfig
   ```

2. **Share with helpers**: Give them `http://<your-ip>:3000/remote`

3. **All devices must be on same network** (same WiFi)

### Configuration

Access the settings page at `http://localhost:3000/settings` to:

- Set current visitor count
- Update initial candy amount
- Reset counter for new session

### Projector and Computer Setup

Best to setup positioning and sizing/zoom before Halloween night.

1. Connect computer to projector via HDMI
2. Open main display at `http://localhost:3000`
3. Press `Ctrl+F` for fullscreen mode
4. Adjust projector focus and positioning

To set all of the screensaver options to allow for long-term, full-screen viewing, set these values:

```sh
sudo pmset -c powernap 0 && sudo pmset -c sleep 0 && sudo pmset -c displaysleep 0 && sudo pmset -c lowpowermode 0 && defaults -currentHost write com.apple.screensaver idleTime 0 && pmset -g
```

To revert (after Halloween):

```sh
sudo pmset -c powernap 1 && sudo pmset -c sleep 1 && sudo pmset -c displaysleep 5 && sudo pmset -c lowpowermode 0 && defaults -currentHost write com.apple.screensaver idleTime 0 && pmset -g
```

## Project Structure

```
halloween-counter/
├── server.js                    # SSE server (Node.js, no dependencies)
├── src/
│   ├── components/
│   │   ├── Counter.tsx         # Main counter display
│   │   ├── CandyProgress.tsx   # Candy inventory bar
│   │   ├── StatsDisplay.tsx    # Statistics dashboard
│   │   └── ZombieHorde.tsx     # Rive zombie animations
│   ├── hooks/
│   │   ├── useCounter.ts       # Server-synced counter logic
│   │   ├── useSSE.ts           # SSE connection management
│   │   ├── useQueryParams.ts   # URL parameter handling
│   │   └── useStats.ts         # Statistics calculations
│   ├── types/
│   │   └── index.ts            # TypeScript definitions
│   ├── App.tsx                 # Main application
│   └── main.tsx                # Entry point
├── public/
│   ├── remote.html             # Mobile remote control
│   ├── settings.html           # Configuration page
│   └── rive/
│       └── zombie.riv          # Zombie animation file
├── dist/                       # Built React app (after npm run build)
└── package.json
```

## Development

### Available Scripts

```bash
npm run dev         # Vite dev server (React only, no SSE)
npm run dev:server  # SSE server only
npm run dev:all     # Build and run SSE server
npm run build       # Build React app for production
npm run server      # Run SSE server (requires dist/)
npm run start       # Build and start everything
npm run lint        # Run ESLint checks
npm run preview     # Preview production build
```

## Technical Architecture

### Server-Sent Events (SSE)

The app uses a lightweight Node.js server with zero external dependencies:

- Real-time state synchronization across all devices
- Automatic reconnection with exponential backoff
- In-memory state management
- CORS enabled for local network access

### Key Endpoints

- `GET /events` - SSE stream for real-time updates
- `POST /increment` - Increment the counter
- `POST /settings` - Update configuration
- `GET /state` - Get current state

## Tips for Halloween Night

1. **Test before dark**: Set up projector and test network connectivity in daylight
2. **Share remote URL**: Give helpers `http://<your-ip>:3000/remote` on their phones
3. **Monitor candy levels**: Watch the progress bar to pace distribution
4. **Use settings page**: Adjust counts at `http://localhost:3000/settings` if needed
5. **Network tips**:
   - Ensure all devices are on same WiFi
   - Keep server running on main display computer
   - Mobile devices will auto-reconnect if connection drops

## Credits

- Zombie animations from the [Rive Community](https://rive.app/community/files/205-385-zombie-character/)

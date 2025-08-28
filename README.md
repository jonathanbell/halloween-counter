# 🎃 Halloween Candy Counter

A fun, interactive Halloween trick-or-treater counter designed to be projected onto your garage door on Halloween night! This React + TypeScript application provides a spooky, animated experience for counting visitors with large, highly visible text and delightful Halloween animations.

![Halloween Counter Preview](https://img.shields.io/badge/Halloween-Ready-orange?style=for-the-badge&logo=ghost)

## ✨ Features

- **🎯 Large, Projection-Optimized Display**: Extra-large text (15-20vh) with high contrast and text shadows for visibility on white garage doors
- **⌨️ Spacebar Counter**: Press spacebar to increment the trick-or-treater count
- **📊 Smart Statistics**: Automatic hourly breakdown displays every N counts (configurable)
- **🎨 Halloween Animations**: Bouncing pumpkins, flying bats, floating ghosts, and more
- **🌐 URL State Management**: Resume counting from a specific number via URL parameters
- **📱 Flexible Aspect Ratio**: Responsive design that adapts to any projector aspect ratio
- **🖥️ Fullscreen Ready**: Double-click or F11 for fullscreen projection mode
- **🎭 Halloween Theme**: Orange, purple, black color scheme optimized for projection

## 🚀 Quick Start

### Installation

```bash
# Clone or navigate to the project directory
cd halloween-candy-counter

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173/`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎮 Usage

### Basic Operation

1. **Start Counting**: Press the spacebar to increment the counter
2. **Fullscreen Mode**: Double-click anywhere or press F11
3. **Statistics**: Automatically displays every 10 counts (configurable)
4. **Exit Stats**: Press spacebar or Escape to return to the counter

### URL Parameters

Customize the experience with URL parameters:

```bash
# Start with a specific count
http://localhost:5173/?currentCount=25

# Change statistics interval
http://localhost:5173/?statsInterval=5

# Combine parameters
http://localhost:5173/?currentCount=15&statsInterval=20
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Spacebar` | Increment counter |
| `F11` | Toggle fullscreen |
| `Escape` | Close statistics display |
| `Double-click` | Toggle fullscreen |

## 🎨 Halloween Animations

The app includes delightful Halloween animations that trigger when counting:

- **🧟 Zombie Character**: Professional Rive animation of a zombie walking across the screen (20s loop)
- **🎃 Hanging Pumpkin**: Animated pumpkin swaying from the top center of the screen
- **👻 Floating Ghost**: Professional Rive ghost animation floating across the screen (15s loop)
- **🎃 Bouncing Pumpkins**: Appear and bounce from screen corners
- **👻 Floating Ghosts**: Emoji ghosts continuously drifting across the screen
- **🦇 Flying Bats**: Zoom across the display in different directions
- **👹 Peeking Monsters**: Pop in from screen edges
- **🍭 Spinning Candy**: Rotates and scales on increments
- **🕸️ Corner Cobwebs**: Static decorative elements

## 🏗️ Project Structure

```
src/
├── components/
│   ├── Counter.tsx          # Main counter display
│   ├── Counter.module.css   # Counter styling
│   ├── StatsDisplay.tsx     # Statistics overlay
│   ├── StatsDisplay.module.css
│   ├── Background.tsx       # Halloween animations
│   ├── Background.module.css
│   ├── RiveAnimation.tsx    # Rive animation wrapper
├── hooks/
│   ├── useQueryParams.ts    # URL parameter handling
│   ├── useCounter.ts        # Counter logic and keyboard events
│   └── useStats.ts          # Statistics tracking
├── assets/
│   └── rive/               # Future Rive animation files
├── App.tsx                 # Main application component
├── App.css                # Application-level styles
└── index.css              # Global styles and theme
```

## 🎨 Customization

### Color Scheme

The Halloween color palette is defined in CSS custom properties:

```css
:root {
  --halloween-orange: #ff6b35;
  --halloween-purple: #8a2be2;
  --halloween-dark-purple: #2d1b69;
  --halloween-black: #000000;
  --halloween-white: #ffffff;
  --halloween-gold: #ffcc00;
}
```

### Responsive Design

The app automatically adjusts for different aspect ratios:
- **Portrait/Square**: Smaller text sizes, stacked layouts
- **Ultra-wide**: Larger text, spread-out animations
- **Standard**: Optimized for typical projector ratios

### Animation Timing

Modify animation durations in the respective CSS files:
- Counter bounce: 600ms
- Background animations: 2s trigger animations
- Stats auto-hide: 5s
- Instruction fade: 10s in fullscreen

## 🔧 Technical Details

### Built With

- **React 18** with TypeScript for type safety
- **Vite** for fast development and building
- **CSS Modules** for component-scoped styling
- **@rive-app/react-canvas** for advanced animations (ready for future use)

### Browser Support

- Chrome/Chromium (recommended for projection)
- Firefox
- Edge
- Safari (limited fullscreen API support)

### Performance Optimizations

- Viewport units for scalable typography
- CSS transforms for smooth animations
- Animation cleanup to prevent memory leaks
- Optimized for 60fps performance
- Minimal bundle size (~150KB gzipped)

## 🎃 Halloween Night Setup

### Pre-Halloween Testing

1. Test on your actual projector setup
2. Verify visibility from street distance
3. Check fullscreen functionality
4. Test spacebar responsiveness
5. Confirm statistics display timing

### Recommended Projector Settings

- **Resolution**: Any HD resolution (app is responsive)
- **Brightness**: Maximum for outdoor visibility
- **Contrast**: High contrast setting
- **Color**: Vivid or Standard mode

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Text too small | Adjust `font-size` in Counter.module.css |
| Poor visibility | Increase `text-shadow` values |
| Animations lagging | Reduce number of background elements |
| Stats showing too often | Increase `statsInterval` parameter |

## 🚀 Future Enhancements

### Planned Features
- **Bluetooth Trigger**: Wireless counter integration
- **Sound Effects**: Optional spooky audio feedback
- **Custom Rive Animations**: Professional Halloween animations
- **Data Export**: Save statistics to file
- **Multiple Counters**: Track different costume categories

### Rive Animation Integration

The project includes a professional zombie character from the Rive community:

```tsx
<RiveAnimation
  src="/assets/rive/zombie-character.riv"
  stateMachine="State Machine 1"
  className="zombieAnimation"
  autoplay={true}
/>
```

The zombie walks across the screen in a 20-second loop, changing direction halfway through. You can add more Rive animations by placing `.riv` files in the `public/assets/rive/` directory.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🎉 Contributing

Feel free to contribute improvements for future Halloween seasons:

1. Fork the repository
2. Create a feature branch
3. Make your spooky improvements
4. Test on a projector setup
5. Submit a pull request

---

**Happy Halloween! 👻🎃**

*May your trick-or-treater count be high and your candy supply be plentiful!*
# Halloween Trick-or-Treater Counter - Project Requirements

## Project Overview

Create a Vite/React single-page application that will be projected onto a garage door on Halloween night via HDMI projector. The app will count trick-or-treaters with fun, spooky animations and be easily viewable from a distance.

## Core Functionality

### Counter System

- Display format: "Trick-or-Treaters: [NUMBER]"
- **Increment trigger**: Spacebar press (initially), with future support for Bluetooth camera trigger
- **Initial count**:
  - Default to 0 if no query parameter present
  - Use `currentCount` query parameter value if provided (e.g., `?currentCount=15`)
- Counter should be the primary visual focus with large, highly visible text

### Statistics Display

- Track trick-or-treaters per hour
- Display statistics periodically based on a configurable threshold
- **Stats trigger**: Show stats after every N trick-or-treaters
  - N should be configurable via query parameter `statsInterval` (default: 10)
  - Example: `?currentCount=0&statsInterval=10`
- Stats should display briefly then return to main counter
- Consider a subtle transition or animation when switching between counter and stats

## Visual Design

### Typography

- **Extra large text** for main counter (minimum 10vh, consider 15-20vh)
- Bold, easily readable font that's visible when projected on white surface
- Consider adding text stroke or shadow for better visibility

### Color Palette

- Halloween themed: Orange, Purple, Black, White
- Ensure high contrast for projection visibility
- White or light-colored text with dark outlines recommended

### Animations & Effects (using Rive)

- **Triggered on increment**:
  - Counter number should animate (scale up/bounce effect)
  - Spawn random spooky elements that float/fly across screen
  - Possible effects: bats flying, ghost floating up, pumpkin bouncing, monster peek-in
- **Background animations**:
  - Continuous floating ghosts or other subtle Halloween elements
  - Should not distract from main counter
  - Keep animations smooth but not overwhelming

### Halloween Elements to Include

- Pumpkins/Jack-o'-lanterns
- Ghosts (floating, semi-transparent)
- Bats (flying across screen)
- Friendly monsters
- Optional: spider webs in corners, witch silhouettes, candy icons

## Technical Requirements

### Stack

- **Build tool**: Vite
- **Framework**: React
- **Animation library**: Rive (<https://rive.app/>)
  - Use @rive-app/react-canvas package
  - Create or source Halloween-themed Rive animations
- **Styling**: CSS Modules or styled-components for maintainability

### Project Structure

```
src/
  components/
    Counter.jsx          # Main counter display
    StatsDisplay.jsx     # Statistics overlay
    Background.jsx       # Background animations
    RiveAnimation.jsx    # Rive animation wrapper
  hooks/
    useQueryParams.js    # Handle URL parameters
    useCounter.js        # Counter logic and persistence
    useStats.js          # Statistics tracking
  assets/
    rive/               # Rive animation files
  App.jsx
  main.jsx
  styles/
    global.css
```

### Key Features to Implement

1. **URL Parameter Handling**

   ```javascript
   // Parse and handle query parameters
   const params = new URLSearchParams(window.location.search);
   const initialCount = parseInt(params.get('currentCount')) || 0;
   const statsInterval = parseInt(params.get('statsInterval')) || 10;
   ```

2. **Counter State Management**
   - Use React hooks (useState, useEffect)
   - Update URL with current count for persistence
   - Implement keyboard event listener for spacebar

3. **Rive Integration**
   - Load Rive animations for Halloween elements
   - Trigger animations on counter increment
   - Continuous background animations
   - Consider creating state machines in Rive for different animation states

4. **Responsive Fullscreen Design**
   - Optimize for 16:9 aspect ratio (common projector resolution)
   - Use viewport units (vw, vh) for sizing
   - Ensure all elements scale properly
   - No scrollbars in fullscreen mode

5. **Performance Considerations**
   - Optimize animations for smooth 60fps playback
   - Limit number of concurrent animations
   - Use CSS transforms for better performance
   - Clean up completed animations to prevent memory leaks

## Future Enhancements (to consider in architecture)

- Bluetooth trigger integration via Web Bluetooth API
- Data persistence to localStorage or external service
- Daily/hourly statistics graphs
- Multiple counter modes (candy types, costume categories)
- Sound effects toggle (currently disabled)
- Reset button with confirmation
- Export statistics feature

## Development Guidelines

### Getting Started

1. Initialize Vite project with React template
2. Install dependencies:

   ```bash
   npm create vite@latest halloween-counter -- --template react
   cd halloween-counter
   npm install @rive-app/react-canvas
   ```

3. Set up Rive animations:
   - Create account at rive.app if needed
   - Design or download Halloween animations
   - Export as .riv files

### Testing Considerations

- Test with different starting counts via query parameters
- Verify visibility at different distances
- Test fullscreen mode in different browsers
- Ensure animations don't cause performance issues
- Test on actual projector if possible before Halloween

### Browser Compatibility

- Target modern browsers (Chrome, Firefox, Edge)
- Ensure fullscreen API support
- Test keyboard event handling

## Delivery

- Single-page application that runs locally
- No backend required
- All assets bundled with build
- Simple to deploy (npm run build → serve dist folder)

## Success Criteria

- Counter clearly visible from street distance when projected
- Smooth animations that enhance but don't distract
- Reliable counting mechanism
- Fun, spooky-but-playful atmosphere
- Easy to operate on Halloween night (just spacebar!)
- Query parameters work for resuming count and configuring stats interval

## Rive Considerations

Guide the developer(s) through the Rive implementation via code comments and suggestions since they have never implemented Rive before.

## Documentation

Create documentation as we go: README.md with technical installation and development instructions. Explain any Rive usage issues here too. Add other documentation as needed for clarity.

---

## Implementation Notes for AI/Claude Code

When implementing this project:

1. Start with basic counter functionality
2. Add URL parameter handling
3. Implement Rive animations incrementally
4. Add statistics display last
5. Focus on performance and visibility throughout
6. Keep the UI simple and focused on the counter
7. Test extensively in fullscreen mode
8. Consider adding keyboard shortcuts for testing (like R for reset, S for stats)

Remember: The primary goal is a fun, visible, and reliable counter for Halloween night. All other features should enhance, not complicate, this core functionality.

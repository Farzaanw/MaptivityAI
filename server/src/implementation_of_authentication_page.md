Login/Sign-Up Overlay with Disintegration Transition
Add a login/sign-up page that appears as a frosted-glass overlay on top of the existing map. On successful auth, the overlay disintegrates away (particle scatter + fade) to reveal the map.

Approach
The login page is purely visual/UI — there is no real backend auth. The form validates that fields are non-empty, then triggers the transition. This keeps it additive (no existing code modified) and lets you wire up real auth later.

How the overlay works
The map and all existing components render normally underneath from the start
A new <AuthOverlay> component renders on top as a position: fixed full-screen layer with a frosted-glass backdrop (backdrop-blur + semi-transparent background)
App.tsx
 holds a single new state: isAuthenticated. When false, the overlay is shown. When true, the overlay is removed from the DOM (after the transition completes)
How the disintegration effect works
I'll implement a canvas-based particle disintegration effect:

When the user clicks "Sign In" / "Sign Up", we capture the overlay's visual appearance using html2canvas (screenshot the DOM node into a canvas)
Hide the original DOM overlay immediately
The canvas is sliced into a grid of small "particle" tiles (~8×8px each)
Each tile is drawn onto an animation canvas, then animated: random velocity, rotation, gravity, and opacity fade — making them scatter outward and disappear
After ~1.2s the animation canvas is removed, revealing the full map
This gives a genuine particle-disintegration feel (like the Thanos snap effect), not just a simple fade.

NOTE

html2canvas is a lightweight library (~40KB gzipped) that screenshots DOM elements into a <canvas>. It's the standard approach for this type of effect and has zero runtime overhead until triggered.

Proposed Changes
Auth Overlay Component
[NEW] 
AuthOverlay.tsx
New component containing:

Full-screen fixed overlay with frosted glass background
Toggle between Login and Sign-Up forms (tabs or link)
Login form: email + password fields
Sign-Up form: name + email + password + confirm password fields
Form validation (non-empty fields, password match for sign-up)
Maptivity branding at top
On submit: calls onAuthenticate() prop which triggers disintegration
Disintegration Effect Hook
[NEW] 
useDisintegrate.ts
Custom hook encapsulating the particle disintegration logic:

useDisintegrate(elementRef) → returns { trigger: () => Promise<void> }
When trigger() is called:
Uses html2canvas to screenshot the referenced element
Creates a full-screen animation canvas
Slices the screenshot into ~8×8px particle tiles
Animates each particle with random direction, velocity, rotation, and gravity
Fades out particles over ~1.2s
Resolves the promise when animation completes
Cleans up the canvas
App Integration
[MODIFY] 
App.tsx
Minimal changes — only adding:

const [isAuthenticated, setIsAuthenticated] = useState(false);
Render <AuthOverlay> conditionally when !isAuthenticated, passing onAuthenticate={() => setIsAuthenticated(true)}
No existing logic, components, or behavior is touched
Dependency
[MODIFY] 
package.json
Add html2canvas as a dependency (needed for the canvas screenshot step of the disintegration effect)
Verification Plan
Browser Testing
Since there are no existing tests in this project and auth is UI-only, verification will be done via browser:

Run npm run dev:all to start the app
Open http://localhost:3000 in browser
Verify overlay appears: The login form should be visible as a frosted-glass overlay, with the map dimly visible behind it
Verify form toggle: Click "Sign Up" to switch to sign-up form, click "Sign In" to switch back
Verify validation: Submit with empty fields — should show validation errors
Verify disintegration: Fill in fields and submit — the overlay should disintegrate into particles that scatter and fade, revealing the map
Verify map works normally: After transition, confirm all existing map functionality works (search, set area, etc.)
IMPORTANT

I'll use the browser tool to visually verify steps 3–7 after implementation.
# Simple Dark Mode

A one-click dark mode for Chrome. No settings, just on and off from the toolbar.

## Installation

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the `simple-dark-mode` folder.
4. *(Optional)* Pin it from the puzzle-piece menu so the button stays visible.

## Usage

Clicking the moon icon turns dark mode on or off for every tab at once. The change is instant, with no page reload.

| Icon | State |
| --- | --- |
| Yellow moon on indigo | Dark mode **on** |
| Grey | Dark mode **off** |

**Keyboard shortcut:** <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> also toggles it. That shortcut is just Chrome's built-in way of clicking the button, so there's nothing to set up.

## How it works

It inverts the page's colours with a CSS filter. Images, videos, canvases and embedded frames get inverted a second time, so they keep their real colours.

Because it's all CSS, it also covers content that JavaScript adds after the page loads, like single-page apps, infinite scroll and popups.

Sites that already have a dark theme are detected and left alone, so they don't get flipped to light. It remembers those sites, so they don't flash on later visits.

Tabs that were already open when you loaded the extension get it automatically.

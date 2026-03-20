import re

with open('src/app/raindrop/albums/page.tsx', 'r') as f:
    content = f.read()

# Replace the swipe hint
content = content.replace("Swipe left or right, swipe down to close, pinch to zoom.", "Tap left or right to navigate, pinch to zoom.")

with open('src/app/raindrop/albums/page.tsx', 'w') as f:
    f.write(content)

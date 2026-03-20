with open('src/app/raindrop/albums/page.tsx', 'r') as f:
    content = f.read()

# Implement the actual click-to-navigate logic in releasePointer
old_nav_logic = """    // Navigation by clicking
    if (modeBeforeRelease === 'idle' && transformRef.current.scale <= 1.02) {
      const startX = interaction.startX;
      const startY = interaction.startY;
      // We don't have the final pointer coordinates in releasePointer.
      // We can modify releasePointer to accept an optional event or use the last known pointer position.
    }"""

new_nav_logic = """    if (modeBeforeRelease === 'idle' && transformRef.current.scale <= 1.02 && event) {
      const deltaX = Math.abs(event.clientX - interaction.startX);
      const deltaY = Math.abs(event.clientY - interaction.startY);

      // Consider it a tap/click if movement was very small
      if (deltaX < 10 && deltaY < 10) {
        // Also check if they clicked directly on the navigation arrows or close button
        // by verifying the target, or simply by the fact that if they did, the click handler on those buttons
        // will fire, and we might double-fire.
        // We can check if the target is the surface or the image wrapper.
        const target = event.target as HTMLElement;
        const isButton = target.closest('button');

        if (!isButton) {
          const rect = viewerRef.current?.getBoundingClientRect();
          const width = rect?.width ?? window.innerWidth;

          if (event.clientX < width / 2) {
            onShowPrevious();
          } else {
            onShowNext();
          }
        }
      }
    }"""

content = content.replace(old_nav_logic, new_nav_logic)

# Replace interactionRef mode definition
content = content.replace("mode: 'idle' | 'swipe' | 'pan' | 'pinch';", "mode: 'idle' | 'pan' | 'pinch';")

with open('src/app/raindrop/albums/page.tsx', 'w') as f:
    f.write(content)

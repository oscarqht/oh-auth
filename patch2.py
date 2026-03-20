import re

with open('src/app/raindrop/albums/page.tsx', 'r') as f:
    content = f.read()

# Remove getAlbumSwipeAction import
content = re.sub(r'  getAlbumSwipeAction,\n', '', content)

# Remove swipe mode
content = content.replace("mode: 'idle' | 'swipe' | 'pan' | 'pinch';", "mode: 'idle' | 'pan' | 'pinch';")

# Replace mouse idle setting with touch idle setting
old_pointer_down = """    if (event.pointerType === 'mouse') {
      interactionRef.current.mode = 'idle';
      return;
    }

    interactionRef.current = {
      mode: 'swipe',
      startX: event.clientX,
      startY: event.clientY,
      baseOffsetX: 0,
      baseOffsetY: 0,
      baseScale: 1,
      pinchDistance: 0,
      pinchMidpointX: 0,
      pinchMidpointY: 0,
    };"""

new_pointer_down = """    interactionRef.current = {
      mode: 'idle',
      startX: event.clientX,
      startY: event.clientY,
      baseOffsetX: 0,
      baseOffsetY: 0,
      baseScale: 1,
      pinchDistance: 0,
      pinchMidpointX: 0,
      pinchMidpointY: 0,
    };"""

content = content.replace(old_pointer_down, new_pointer_down)

# Remove swipe from pointer move
old_pointer_move = """    if (interaction.mode === 'swipe') {
      commitTransform({
        scale: 1,
        offsetX: event.clientX - interaction.startX,
        offsetY: event.clientY - interaction.startY,
      }, {
        allowOffsetAtBaseScale: true,
      });
    }"""
content = content.replace(old_pointer_move, "")

# Modify release pointer
old_release_pointer = """    const interaction = interactionRef.current;
    interactionRef.current.mode = 'idle';

    if (interaction.mode !== 'swipe') {
      if (transformRef.current.scale <= 1.02) {
        commitTransform({
          scale: 1,
          offsetX: 0,
          offsetY: 0,
        });
      }
      return;
    }

    const { offsetX, offsetY } = transformRef.current;
    const swipeAction = getAlbumSwipeAction(offsetX, offsetY);

    commitTransform({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    });

    if (swipeAction === 'close') {
      onClose();
      return;
    }

    if (swipeAction == null) {
      return;
    }

    if (swipeAction === 'previous') {
      onShowPrevious();
    } else {
      onShowNext();
    }"""

new_release_pointer = """    const interaction = interactionRef.current;
    interactionRef.current.mode = 'idle';

    if (transformRef.current.scale <= 1.02) {
      commitTransform({
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      });
    }

    // Handle clicks for navigation if there was barely any movement
    // and we were not previously scaled/panning.
    if (interaction.mode === 'idle' && transformRef.current.scale <= 1.02) {
      const pointer = pointersRef.current.get(pointerId);
      // We check if it's a click by comparing end position with start position
      // Actually, since pointer x/y might be updated on move, we should compare
      // the event clientX/clientY with startX/startY.
      // But pointer is deleted before this check? No, let's use the event directly in handlePointerUp,
      // Wait, releasePointer is called from handlePointerUp and Cancel and it takes pointerId, not event.
      // So we can check the pointer's last x/y before deleting it.
      // Let's refactor this.
    }"""

# For now, let's just write the intermediate content and handle releasePointer more carefully
with open('src/app/raindrop/albums/page.tsx', 'w') as f:
    f.write(content)

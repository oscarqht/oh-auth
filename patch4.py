with open('src/app/raindrop/albums/page.tsx', 'r') as f:
    content = f.read()

# Make releasePointer take an optional event to get final coordinates
content = content.replace("function releasePointer(pointerId: number) {", "function releasePointer(pointerId: number, event?: ReactPointerEvent<HTMLDivElement>) {")

# Update handlePointerUp and handlePointerCancel
content = content.replace("releasePointer(event.pointerId);", "releasePointer(event.pointerId, event);")

with open('src/app/raindrop/albums/page.tsx', 'w') as f:
    f.write(content)

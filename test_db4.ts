const limit = 2;
const messages = [
  { id: 3, createdAt: 3 },
  { id: 2, createdAt: 2 },
  { id: 1, createdAt: 1 }
]; // simulated desc order (newest first)

let nextCursor = undefined;
if (messages.length > limit) {
  const nextItem = messages.pop();
  nextCursor = nextItem?.id;
}

const resultMessages = messages.reverse();
console.log('Result:', resultMessages);
console.log('Next Cursor:', nextCursor);

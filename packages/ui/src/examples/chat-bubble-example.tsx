import { ChatBubble } from "../components/chat-bubble";

export function ChatBubbleExample() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <ChatBubble
          content="Can you help me write a React component that implements a chat interface with message bubbles?"
          avatarSrc="https://github.com/deep9333.png"
          avatarFallback="JD"
        />
      </div>
    </div>
  );
}

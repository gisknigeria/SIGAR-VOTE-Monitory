import { useMemo, useState } from "react";
import { FaTimes } from "react-icons/fa";

export default function ChatPanel({
  rooms,
  activeRoom,
  messages,
  users,
  currentUser,
  isAdmin,
  onClose,
  onCreateRoom,
  onSelectRoom,
  onSend,
  onAddMember,
  onDeleteRoom,
}) {
  const [newRoom, setNewRoom] = useState({ name: "", userId: "" });
  const [memberId, setMemberId] = useState("");
  const [text, setText] = useState("");

  const names = useMemo(
    () =>
      Object.fromEntries(
        users.map((user) => [
          user.id,
          user.rank ? `${user.rank} ${user.name}` : user.name,
        ]),
      ),
    [users],
  );

  const officers = users.filter((user) =>
    ["Response Team", "Agent"].includes(user.role),
  );

  const submitRoom = async (e) => {
    e.preventDefault();
    if (!newRoom.name.trim()) return;
    await onCreateRoom(newRoom);
    setNewRoom({ name: "", userId: "" });
  };

  const submitMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() || !activeRoom) return;
    await onSend(text);
    setText("");
  };

  const addMember = async () => {
    if (!memberId || !activeRoom) return;
    await onAddMember(activeRoom, memberId);
    setMemberId("");
  };

  return (
    <section className="chat-panel">
      <div className="camera-head">
        <div>
          <span className="eyebrow">IN-HOUSE CHAT</span>
          <h2>Command messages</h2>
        </div>
        <button className="icon-btn" onClick={onClose}>
          <FaTimes />
        </button>
      </div>
      <div className="chat-layout">
        <aside className="chat-rooms">
          {rooms.map((room) => (
            <button
              key={room.id}
              className={activeRoom?.id === room.id ? "active" : ""}
              onClick={() => onSelectRoom(room)}
            >
              <b>{room.name}</b>
              <span>
                {room.type === "incident"
                  ? "Incident chat"
                  : `${room.members?.length || 0} members`}
              </span>
            </button>
          ))}
          {!rooms.length && (
            <div className="empty-cameras">
              <b>No chat rooms yet</b>
              <span>
                {isAdmin
                  ? "Create one and add field personnel."
                  : "Command will add you to a room."}
              </span>
            </div>
          )}
          {isAdmin && (
            <form className="chat-create" onSubmit={submitRoom}>
              <h3>Create room</h3>
              <input
                value={newRoom.name}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, name: e.target.value })
                }
                placeholder="Room name"
              />
              <select
                value={newRoom.userId}
                onChange={(e) =>
                  setNewRoom({ ...newRoom, userId: e.target.value })
                }
              >
                <option value="">Add field personnel now</option>
                {officers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {names[user.id]}
                  </option>
                ))}
              </select>
              <button className="primary">Create chat</button>
            </form>
          )}
        </aside>
        <div className="chat-main">
          {activeRoom ? (
            <>
              <div className="chat-room-head">
                <div>
                  <b>{activeRoom.name}</b>
                  <small>
                    {(activeRoom.members || [])
                      .map((id) => names[id] || id)
                      .join(", ")}
                  </small>
                </div>
                {isAdmin && (
                  <button
                    className="delete-btn"
                    onClick={() => onDeleteRoom(activeRoom)}
                  >
                    Delete chat
                  </button>
                )}
                {isAdmin && (
                  <div className="chat-add">
                    <select
                      value={memberId}
                      onChange={(e) => setMemberId(e.target.value)}
                    >
                      <option value="">Add field personnel</option>
                      {officers
                        .filter(
                          (user) =>
                            !(activeRoom.members || []).includes(user.id),
                        )
                        .map((user) => (
                          <option key={user.id} value={user.id}>
                            {names[user.id]}
                          </option>
                        ))}
                    </select>
                    <button onClick={addMember}>Add</button>
                  </div>
                )}
              </div>
              <div className="chat-messages">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`chat-message ${message.senderId === currentUser.id ? "mine" : ""}`}
                  >
                    <b>
                      {names[message.senderId] ||
                        (message.senderId === currentUser.id ? "You" : "User")}
                    </b>
                    <p>{message.body}</p>
                    <time>
                      {new Date(message.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </div>
                ))}
                {!messages.length && (
                  <div className="empty-cameras">
                    <b>No messages yet</b>
                    <span>Send the first update.</span>
                  </div>
                )}
              </div>
              <form className="chat-send" onSubmit={submitMessage}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message"
                />
                <button className="primary">Send</button>
              </form>
            </>
          ) : (
            <div className="empty-cameras">
              <b>Select a room</b>
              <span>Use incident chat for case-specific communication.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

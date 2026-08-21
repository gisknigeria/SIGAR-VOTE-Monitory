import { useMemo, useRef, useState } from "react";
import { FaFile, FaImage, FaPaperclip, FaTimes, FaTrash, FaVideo } from "react-icons/fa";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_BYTES = 7 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv", "text/plain", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/webm",
]);
const kindFor = (mime) => mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document";
const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
  reader.readAsDataURL(file);
});

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
  const [attachments, setAttachments] = useState([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [sending, setSending] = useState(false);
  const fileRef = useRef(null);

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
    if ((!text.trim() && !attachments.length) || !activeRoom || sending) return;
    setSending(true); setAttachmentError("");
    try {
      await onSend({ body: text.trim(), attachments });
      setText(""); setAttachments([]);
    } catch (error) { setAttachmentError(error.message || "Message could not be sent."); }
    finally { setSending(false); }
  };

  const selectFiles = async (event) => {
    const files = [...(event.target.files || [])];
    event.target.value = "";
    setAttachmentError("");
    if (attachments.length + files.length > 3) return setAttachmentError("Attach at most 3 files to one message.");
    try {
      const next = [];
      for (const file of files) {
        if (!ALLOWED_MIME.has(file.type)) throw new Error(`${file.name} is not a supported image, video, PDF, Office, CSV, or text file.`);
        if (file.size > MAX_FILE_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
        next.push({ type: kindFor(file.type), name: file.name, mimeType: file.type, size: file.size, data: await readFile(file) });
      }
      if ([...attachments, ...next].reduce((total, item) => total + item.size, 0) > MAX_TOTAL_BYTES) throw new Error("Attachments must be 7 MB or smaller in total.");
      setAttachments((old) => [...old, ...next]);
    } catch (error) { setAttachmentError(error.message); }
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
                    {!!message.attachments?.length && <div className="chat-attachments">{message.attachments.map((attachment, index) => (
                      <div className={`chat-attachment ${attachment.type}`} key={`${attachment.name}-${index}`}>
                        {attachment.type === "image" ? <img src={attachment.data} alt={attachment.name} /> : attachment.type === "video" ? <video src={attachment.data} controls preload="metadata" /> : <FaFile />}
                        <span><b>{attachment.name}</b><a href={attachment.data} download={attachment.name} target="_blank" rel="noreferrer">Open or download</a></span>
                      </div>
                    ))}</div>}
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
                {!!attachments.length && <div className="chat-selected-files">{attachments.map((item, index) => <span key={`${item.name}-${index}`}>{item.type === "image" ? <FaImage /> : item.type === "video" ? <FaVideo /> : <FaFile />}<b>{item.name}</b><button type="button" onClick={() => setAttachments((old) => old.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove ${item.name}`}><FaTrash /></button></span>)}</div>}
                {attachmentError && <p className="chat-attachment-error">{attachmentError}</p>}
                <input ref={fileRef} className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={selectFiles} />
                <button type="button" className="chat-attach-button" onClick={() => fileRef.current?.click()} title="Attach evidence"><FaPaperclip /><span>Attach</span></button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message or attach evidence"
                />
                <button className="primary" disabled={sending || (!text.trim() && !attachments.length)}>{sending ? "Sending…" : "Send"}</button>
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

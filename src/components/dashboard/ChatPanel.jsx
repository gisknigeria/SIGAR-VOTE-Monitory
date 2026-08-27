import { useMemo, useRef, useState } from "react";
import { FaFile, FaImage, FaPaperclip, FaTimes, FaTrash, FaVideo } from "react-icons/fa";

const MAX_CHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const MAX_CHAT_TOTAL_BYTES = 7 * 1024 * 1024;
const mimeByExtension = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv", txt: "text/plain", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
  mp4: "video/mp4", webm: "video/webm",
};
const attachmentKind = mime => mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : "document";
const fileAsDataUrl = (file, mimeType) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || "").replace(/^data:[^;,]+;/, `data:${mimeType};`));
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
  const fileInputRef = useRef(null);

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
    setSending(true);
    setAttachmentError("");
    try {
      await onSend({ body: text.trim(), attachments });
      setText("");
      setAttachments([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setAttachmentError(error.message || "Could not send this message");
    } finally {
      setSending(false);
    }
  };

  const selectAttachments = async (event) => {
    const files = Array.from(event.target.files || []);
    setAttachmentError("");
    if (attachments.length + files.length > 3) {
      setAttachmentError("You can attach at most 3 files to one message.");
      event.target.value = "";
      return;
    }
    try {
      const next = [];
      for (const file of files) {
        const extension = file.name.split(".").pop()?.toLowerCase() || "";
        const mimeType = file.type || mimeByExtension[extension] || "";
        if (!Object.values(mimeByExtension).includes(mimeType)) throw new Error(`${file.name} is not a supported image, video, or document.`);
        if (file.size > MAX_CHAT_ATTACHMENT_BYTES) throw new Error(`${file.name} is larger than 5 MB.`);
        next.push({ type: attachmentKind(mimeType), name: file.name, mimeType, size: file.size, data: await fileAsDataUrl(file, mimeType) });
      }
      if ([...attachments, ...next].reduce((sum, item) => sum + Number(item.size || 0), 0) > MAX_CHAT_TOTAL_BYTES) throw new Error("Attachments must be 7 MB or smaller in total.");
      setAttachments((current) => [...current, ...next]);
    } catch (error) {
      setAttachmentError(error.message || "Could not attach this file.");
    } finally {
      event.target.value = "";
    }
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
          <label className="chat-room-selector-label" htmlFor="chat-room-selector">
            Chat room
          </label>
          <select
            id="chat-room-selector"
            className="chat-room-selector"
            value={activeRoom?.id || ""}
            onChange={(e) => {
              const room = rooms.find((item) => item.id === e.target.value);
              if (room) onSelectRoom(room);
            }}
          >
            <option value="">Select a room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
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
                      <div key={`${attachment.name}-${index}`} className={`chat-attachment ${attachment.type}`}>
                        {attachment.type === "image" ? <img src={attachment.data} alt={attachment.name || "Chat attachment"} /> : attachment.type === "video" ? <video src={attachment.data} controls preload="metadata" /> : <FaFile />}
                        <span><b>{attachment.name || `Attachment ${index + 1}`}</b><a href={attachment.data} download={attachment.name || "attachment"} target="_blank" rel="noreferrer">{attachment.type === "document" ? "Open or download document" : "Open or download"}</a></span>
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
                {!!attachments.length && <div className="chat-selected-files">{attachments.map((attachment, index) => <span key={`${attachment.name}-${index}`}>{attachment.type === "image" ? <FaImage /> : attachment.type === "video" ? <FaVideo /> : <FaFile />}<b>{attachment.name}</b><button type="button" title="Remove attachment" onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}><FaTrash /></button></span>)}</div>}
                {attachmentError && <p className="chat-attachment-error">{attachmentError}</p>}
                <input ref={fileInputRef} className="chat-file-input" type="file" multiple accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={selectAttachments} />
                <button type="button" className="chat-attach-button" onClick={() => fileInputRef.current?.click()} title="Attach image, video, or document"><FaPaperclip /><span>Attach</span></button>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type a message or attach files"
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

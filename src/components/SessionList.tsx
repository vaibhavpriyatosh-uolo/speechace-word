interface SessionListProps {
  sessions: string[];
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
}

export default function SessionList({
  sessions,
  selectedSessionId,
  onSelectSession,
  onDeleteSession,
}: SessionListProps) {
  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <p>No sessions yet</p>
        <p className="empty-state-hint">
          Send a POST request to /api/speech-detection to create a session
        </p>
      </div>
    );
  }

  return (
    <div className="session-list">
      {sessions.map((sessionId) => (
        <div
          key={sessionId}
          className={`session-card ${
            selectedSessionId === sessionId ? 'selected' : ''
          }`}
        >
          <div
            className="session-card-content"
            onClick={() => onSelectSession(sessionId)}
          >
            <h3 className="session-id">{sessionId}</h3>
          </div>
          <button
            className="button button-danger button-small"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSession(sessionId);
            }}
          >
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

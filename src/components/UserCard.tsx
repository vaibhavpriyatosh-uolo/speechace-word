import { User } from '@/types';

interface UserCardProps {
  user: User;
  onDelete: (id: number) => void;
}

export default function UserCard({ user, onDelete }: UserCardProps) {
  return (
    <div className="card">
      <h3>{user.name}</h3>
      <p>{user.email}</p>
      <button
        className="button button-danger"
        onClick={() => onDelete(user.id)}
      >
        Delete
      </button>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { User } from '@/types';

export default function Home() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.users.getAll();
      setUsers(response.data.data);
    } catch (err) {
      setError('Failed to fetch users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    try {
      setIsAdding(true);
      setError('');
      await api.users.create({ name, email });
      setName('');
      setEmail('');
      await fetchUsers();
    } catch (err) {
      setError('Failed to add user');
      console.error(err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      setError('');
      await api.users.delete(id);
      await fetchUsers();
    } catch (err) {
      setError('Failed to delete user');
      console.error(err);
    }
  };

  return (
    <>
      <header className="header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>Next.js Fullstack Boilerplate</h1>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <a href="/" style={{ color: '#0070f3', fontWeight: 500 }}>Home</a>
            <a href="/speech" style={{ color: '#0070f3', fontWeight: 500 }}>Speech Detection</a>
            <a href="/record" style={{ color: '#0070f3', fontWeight: 500 }}>Record</a>
          </nav>
        </div>
      </header>

      <div className="container">
        <div className="card">
          <h2>Add New User</h2>
          <form onSubmit={handleAddUser}>
            <div className="form-group">
              <label className="label" htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                className="input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter name"
                required
              />
            </div>
            <div className="form-group">
              <label className="label" htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter email"
                required
              />
            </div>
            <button type="submit" className="button" disabled={isAdding}>
              {isAdding ? 'Adding...' : 'Add User'}
            </button>
          </form>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="card">
          <h2>Users List</h2>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <ul className="user-list">
              {users.map((user) => (
                <li key={user.id} className="user-item">
                  <div className="user-info">
                    <h3>{user.name}</h3>
                    <p>{user.email}</p>
                  </div>
                  <div className="user-actions">
                    <button
                      className="button button-danger"
                      onClick={() => handleDeleteUser(user.id)}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

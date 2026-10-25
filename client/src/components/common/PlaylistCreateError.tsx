import React from 'react';
import { Link } from 'react-router-dom';

// Shared error line for the create-playlist forms; a 403 means the Free playlist limit was hit.
export const PlaylistCreateError: React.FC<{ error: any; onUpgrade?: () => void }> = ({ error, onUpgrade }) => {
  if (!error) return null;
  const limitReached = error.response?.status === 403;
  return (
    <p role="alert" className="text-xs text-amber-200">
      {error.response?.data?.message || 'Không tạo được playlist. Vui lòng thử lại.'}
      {limitReached && (
        <>
          {' '}
          <Link to="/music-pro" onClick={onUpgrade} className="underline font-semibold text-amber-300">
            Nâng cấp Music Pro
          </Link>
        </>
      )}
    </p>
  );
};

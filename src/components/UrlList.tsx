import React from 'react';
import { UrlPattern } from '../hooks/useUrlPatterns';

interface UrlListProps {
  urlPatterns: (string | UrlPattern)[];
  onRemove: (index: number) => void;
}

const UrlList: React.FC<UrlListProps> = ({ urlPatterns, onRemove }) => {
  if (urlPatterns.length === 0) {
    return <p className="text-gray-500 p-4">Nenhum padrão de URL configurado</p>;
  }

  return (
    <ul className="list-none">
      {urlPatterns.map((pattern, index) => (
        <li key={index} className="p-4 border-b border-gray-200 flex justify-between items-start">
          <div className="pattern-info">
            {typeof pattern === 'string' ? (
              <p><strong>URL:</strong> {pattern}</p>
            ) : (
              <>
                <p><strong>URL:</strong> {pattern.url}</p>
                <p><strong>Método:</strong> {pattern.method || 'ANY'}</p>
                {pattern.headerName && pattern.headerValue && (
                  <p>
                    <strong>Header ({pattern.headerType || 'request'}):</strong>{' '}
                    {pattern.headerName}: {pattern.headerValue}
                  </p>
                )}
              </>
            )}
          </div>
          <button
            onClick={() => onRemove(index)}
            className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
          >
            Remover
          </button>
        </li>
      ))}
    </ul>
  );
};

export default UrlList;

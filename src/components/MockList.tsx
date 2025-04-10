import React from 'react';
import { MockConfig } from '../hooks/useMocks';

interface MockListProps {
  mocks: MockConfig[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => Promise<boolean>;
  onToggle: (index: number) => Promise<boolean>;
}

const MockList: React.FC<MockListProps> = ({ mocks, onEdit, onRemove, onToggle }) => {
  if (mocks.length === 0) {
    return <p className="text-gray-500 p-4">Nenhum mock configurado</p>;
  }

  return (
    <div className="space-y-2">
      {mocks.map((mock, index) => (
        <div
          key={index}
          className={`p-3 border rounded hover:bg-gray-50 ${mock.enabled ? '' : 'opacity-50'}`}
        >
          <div className="flex justify-between items-start">
            <div className="mock-info">
              <div className="font-medium">{mock.urlPattern}</div>
              <div className="text-sm text-gray-500">
                {mock.method} | Status: {mock.status}
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => onToggle(index)}
                className={`px-2 py-1 rounded text-sm ${
                  mock.enabled
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 hover:bg-gray-400 text-gray-700'
                }`}
                title={mock.enabled ? 'Desabilitar' : 'Habilitar'}
              >
                {mock.enabled ? 'Ativo' : 'Inativo'}
              </button>
              <button
                onClick={() => onEdit(index)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
              >
                Editar
              </button>
              <button
                onClick={() => onRemove(index)}
                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-sm"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MockList;

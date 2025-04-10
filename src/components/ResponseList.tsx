import React from 'react';
import { InterceptedResponse } from '../hooks/useResponses';

interface ResponseListProps {
  responses: Record<string, InterceptedResponse>;
  onSelect: (requestId: string) => void;
}

const ResponseList: React.FC<ResponseListProps> = ({ responses, onSelect }) => {
  const responseIds = Object.keys(responses);
  
  if (responseIds.length === 0) {
    return <p className="text-gray-500 p-4 no-responses">Nenhuma requisição interceptada</p>;
  }
  
  // Ordenar por timestamp (mais recente primeiro)
  responseIds.sort((a, b) => responses[b].timestamp - responses[a].timestamp);
  
  return (
    <div className="space-y-2">
      {responseIds.map(requestId => {
        const response = responses[requestId];
        return (
          <div
            key={requestId}
            className="p-3 border rounded cursor-pointer hover:bg-gray-50 response-item"
            onClick={() => onSelect(requestId)}
          >
            <div className="font-medium truncate url">{response.url}</div>
            <div className="text-sm text-gray-500 details">
              {response.status} {response.statusText} | {response.type} | {response.mimeType}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ResponseList;

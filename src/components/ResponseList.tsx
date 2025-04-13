import React from 'react';
import { InterceptedResponse } from '../hooks/useResponses';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ResponseListProps {
  responses: Record<string, InterceptedResponse>;
  onSelect: (requestId: string) => void;
  onIgnore?: (requestId: string) => Promise<boolean>;
  showIgnoreButton?: boolean;
}

const ResponseList: React.FC<ResponseListProps> = ({
  responses,
  onSelect,
  onIgnore,
  showIgnoreButton = true
}) => {
  const responseIds = Object.keys(responses);

  if (responseIds.length === 0) {
    return <p className="text-gray-500 p-4 no-responses">Nenhuma requisição encontrada</p>;
  }

  // Ordenar por timestamp (mais recente primeiro)
  responseIds.sort((a, b) => responses[b].timestamp - responses[a].timestamp);

  const handleIgnore = async (e: React.MouseEvent, requestId: string) => {
    e.stopPropagation(); // Evita que o clique propague para o card
    if (onIgnore) {
      await onIgnore(requestId);
    }
  };

  return (
    <ScrollArea className="h-[500px] pr-4">
      <div className="space-y-3">
        {responseIds.map(requestId => {
          const response = responses[requestId];
          return (
            <Card
              key={requestId}
              className="response-item hover:bg-accent/5 transition-colors"
            >
              <CardContent className="p-4">
                <div
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => onSelect(requestId)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={response.isWaiting ? "destructive" : "outline"} className="text-xs">
                        {response.isWaiting ? "Aguardando" : "Interceptado"}
                      </Badge>
                      <span className="text-sm font-medium">{response.method || 'GET'}</span>
                    </div>
                    <h3 className="font-medium truncate url">{response.url}</h3>
                    <div className="text-sm text-muted-foreground details mt-1">
                      {response.status} {response.statusText} | {response.type} | {response.mimeType}
                    </div>
                  </div>
                  {showIgnoreButton && onIgnore && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-2 h-8 px-2"
                      onClick={(e) => handleIgnore(e, requestId)}
                      title="Ignorar requisição"
                    >
                      <Icon name="close" className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </ScrollArea>
  );
};

export default ResponseList;

import React, { useState, useEffect } from 'react';
import { InterceptedResponse } from '../hooks/useResponses';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';

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
  // Estado para forçar a atualização do componente a cada segundo
  const [currentTime, setCurrentTime] = useState(Date.now());
  
  // Efeito para atualizar o tempo a cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
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
  
  // Função para calcular o tempo de espera em segundos
  const getWaitingTime = (timestamp: number) => {
    return Math.floor((currentTime - timestamp) / 1000);
  };

  // Função para obter a primeira letra do método HTTP
  const getMethodInitial = (method: string) => {
    return (method || 'G').charAt(0);
  };

  // Função para obter a cor de fundo do avatar com base no método
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500';
      case 'POST':
        return 'bg-blue-500';
      case 'PUT':
        return 'bg-amber-500';
      case 'DELETE':
        return 'bg-red-500';
      case 'PATCH':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <ScrollArea className="h-[380px] pr-4">
      <div className="space-y-3">
        {responseIds.map(requestId => {
          const response = responses[requestId];
          const method = response.method || 'GET';
          const avatarColor = getMethodColor(method);
          
          return (
            <Card
              key={requestId}
              className={`response-item hover:bg-accent/5 transition-colors cursor-pointer overflow-hidden ${
                response.isWaiting ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'
              }`}
              onClick={() => onSelect(requestId)}
            >
              <CardContent className="p-0">
                <div className="flex items-center p-4">
                  <Avatar className={`h-10 w-10 ${avatarColor} text-white`}>
                    <span className="text-sm font-bold">{getMethodInitial(method)}</span>
                  </Avatar>
                  
                  <div className="ml-4 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">
                          {(() => {
                            try {
                              return new URL(response.url).pathname;
                            } catch (e) {
                              // Fallback para URLs inválidas
                              return response.url.split('?')[0];
                            }
                          })()}
                        </h3>
                        <Badge variant={response.isWaiting ? "destructive" : "outline"} className="text-xs">
                          {response.isWaiting ? "Aguardando" : "Interceptado"}
                        </Badge>
                      </div>
                      
                      {showIgnoreButton && onIgnore && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 rounded-full"
                          onClick={(e) => handleIgnore(e, requestId)}
                          title="Ignorar requisição"
                        >
                          <Icon name="close" className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="flex items-center text-sm text-muted-foreground mt-1">
                      <span className="font-medium text-foreground">{method}</span>
                      <Separator orientation="vertical" className="mx-2 h-3" />
                      <span>{response.status} {response.statusText}</span>
                      <Separator orientation="vertical" className="mx-2 h-3" />
                      <span className="truncate">{response.mimeType}</span>
                      
                      {response.isWaiting && (
                        <>
                          <Separator orientation="vertical" className="mx-2 h-3" />
                          <Badge variant="secondary" className="text-xs">
                            {getWaitingTime(response.timestamp)}s
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
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

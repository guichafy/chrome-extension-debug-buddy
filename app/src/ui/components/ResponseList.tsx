import React, { useState, useEffect } from 'react';
import { InterceptedResponse } from '../hooks/useResponses';
import { Button } from '@/ui/components/shadcn/button';
import { Icon } from '@/ui/components/shadcn/icon';
import { Card, CardContent } from '@/ui/components/shadcn/card';
import { Badge } from '@/ui/components/shadcn/badge';
import { ScrollArea } from '@/ui/components/shadcn/scroll-area';
import { Separator } from '@/ui/components/shadcn/separator';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/ui/components/shadcn/tooltip';

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

  // Função para obter a cor do badge com base no método HTTP
  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET':
        return 'bg-green-500 hover:bg-green-500/90';
      case 'POST':
        return 'bg-blue-500 hover:bg-blue-500/90';
      case 'PUT':
        return 'bg-amber-500 hover:bg-amber-500/90';
      case 'DELETE':
        return 'bg-red-500 hover:bg-red-500/90';
      case 'PATCH':
        return 'bg-purple-500 hover:bg-purple-500/90';
      default:
        return 'bg-gray-500 hover:bg-gray-500/90';
    }
  };

  return (
    <TooltipProvider>
      <ScrollArea className="h-[380px] pr-4">
        <div className="space-y-1.5">
          {responseIds.map(requestId => {
            const response = responses[requestId];
            const method = response.method || 'GET';
            const methodColor = getMethodColor(method);
            const waitingTime = getWaitingTime(response.timestamp);

            // Extrair o pathname da URL
            const pathname = (() => {
              try {
                return new URL(response.url).pathname;
              } catch (e) {
                // Fallback para URLs inválidas
                return response.url.split('?')[0];
              }
            })();

            return (
              <Card
                key={requestId}
                className={`response-item hover:bg-accent/5 transition-colors cursor-pointer overflow-hidden ${
                  response.isWaiting ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-green-500'
                }`}
                onClick={() => onSelect(requestId)}
              >
                <CardContent className="p-0">
                  <div className="py-1.5 px-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <h3 className="font-medium truncate text-sm max-w-[220px]">
                                {pathname}
                              </h3>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs break-all">{response.url}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Badge variant={response.isWaiting ? "destructive" : "outline"} className="text-[10px] h-4 px-1.5 py-0">
                            {response.isWaiting ? "Aguardando" : "Interceptado"}
                          </Badge>
                          {response.isWaiting && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
                              {waitingTime}s
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center text-xs text-muted-foreground">
                          <Badge variant="default" className={`${methodColor} text-[10px] h-4 px-1.5 py-0 font-medium`}>{method}</Badge>
                          <Separator orientation="vertical" className="mx-1.5 h-2.5" />
                          <span className="whitespace-nowrap">{response.status} {response.statusText}</span>
                          <Separator orientation="vertical" className="mx-1.5 h-2.5" />
                          <span className="truncate max-w-[150px]" title={response.mimeType}>{response.mimeType}</span>
                        </div>
                      </div>

                      {showIgnoreButton && onIgnore && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => handleIgnore(e, requestId)}
                            >
                              <Icon name="close" className="h-4 w-4" />
                              <span className="sr-only">Ignorar</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ignorar requisição</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </TooltipProvider>
  );
};

export default ResponseList;

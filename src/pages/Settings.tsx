import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import UrlForm from '../components/UrlForm';
import UrlList from '../components/UrlList';
import { useUrlPatterns } from '../hooks/useUrlPatterns';

const Settings: React.FC = () => {
  const { urlPatterns, addUrlPattern, removeUrlPattern } = useUrlPatterns();

  return (
    <>
      <Card className="panel">
        <CardHeader>
          <CardTitle>Configurar interceptação</CardTitle>
        </CardHeader>
        <CardContent className="input-group">
          <UrlForm onAdd={addUrlPattern} />
        </CardContent>
      </Card>

      <Card className="panel mt-4">
        <CardHeader>
          <CardTitle>URLs configuradas</CardTitle>
        </CardHeader>
        <CardContent>
          <UrlList urlPatterns={urlPatterns} onRemove={removeUrlPattern} />
        </CardContent>
      </Card>
    </>
  );
};

export default Settings;

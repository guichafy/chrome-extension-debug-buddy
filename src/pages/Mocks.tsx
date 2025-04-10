import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Icon } from '../components/ui/icon';
import MockList from '../components/MockList';
import MockEditor from '../components/MockEditor';
import { useMocks } from '../hooks/useMocks';

const Mocks: React.FC = () => {
  const {
    mocks,
    currentEditingMockIndex,
    saveMock,
    removeMock,
    toggleMockEnabled,
    editMock,
    cancelEdit
  } = useMocks();

  return (
    <>
      <Card className="panel">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Configuração de Mocks</CardTitle>
            <Button
              className="primary-button flex items-center gap-2"
              onClick={() => editMock(-1)}
            >
              <Icon name="add" />
              Adicionar Mock
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <MockList
            mocks={mocks}
            onEdit={editMock}
            onRemove={removeMock}
            onToggle={toggleMockEnabled}
          />
        </CardContent>
      </Card>

      {currentEditingMockIndex !== -1 && (
        <Card className="panel mt-4">
          <CardHeader>
            <CardTitle>Configuração de Mock</CardTitle>
          </CardHeader>
          <CardContent>
            <MockEditor
              initialData={currentEditingMockIndex >= 0 ? mocks[currentEditingMockIndex] : undefined}
              onSave={saveMock}
              onCancel={cancelEdit}
            />
          </CardContent>
        </Card>
      )}
    </>
  );
};

export default Mocks;

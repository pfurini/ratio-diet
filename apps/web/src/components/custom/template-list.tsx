'use client';

import { api } from '@ratio-diet/backend/convex/_generated/api';
import type { Id } from '@ratio-diet/backend/convex/_generated/dataModel';
import { Button } from '@ratio-diet/ui/components/button';
import { useMutation, useQuery } from 'convex/react';
import { toast } from 'sonner';

interface Template {
  _id: Id<'templates'>;
  name: string;
}

const TemplateRow = ({
  template,
  onDelete,
}: {
  template: Template;
  onDelete: (id: Id<'templates'>) => Promise<void>;
}) => {
  const handleDelete = async () => {
    await onDelete(template._id);
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <p className="font-medium">{template.name}</p>
      <Button
        variant="destructive"
        size="sm"
        onClick={handleDelete}
        aria-label={`Elimina template ${template.name}`}
      >
        Elimina
      </Button>
    </div>
  );
};

const TemplateList = () => {
  const templates = useQuery(api.templates.list);
  const removeTemplate = useMutation(api.templates.remove);

  const handleDelete = async (templateId: Id<'templates'>) => {
    try {
      await removeTemplate({ templateId });
      toast.success('Template eliminato');
    } catch {
      toast.error('Errore durante l\'eliminazione del template.');
    }
  };

  if (templates === undefined) {
    return (
      <p className="text-muted-foreground text-sm" role="status" aria-live="polite" aria-busy="true">
        Caricamento...
      </p>
    );
  }

  if (templates.length === 0) {
    return <p className="text-muted-foreground text-sm">Nessun template salvato.</p>;
  }

  return (
    <div className="space-y-2">
      {templates.map((template) => (
        <TemplateRow key={template._id} template={template} onDelete={handleDelete} />
      ))}
    </div>
  );
};

export default TemplateList;

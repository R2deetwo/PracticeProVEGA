
import React from 'react';
import { AloaArtifact, AloaConfirmationData, ModalType } from '../../types';
import { useUI } from '../../contexts/UIContext';
import { PlusIcon, EditIcon } from '../../constants';
import { Button } from '../toolkit/Button';
import { useProduct } from '../../contexts/ProductContext';

const FormArtifact: React.FC<{ artifact: AloaArtifact }> = ({ artifact }) => {
    const { openModal, activeFormSnapshot } = useUI();
    const data = artifact.data;
    const friendlyName = data.formType.replace('new', '').replace(/([A-Z])/g, ' $1').trim();
    
    const handleOpen = () => {
        // Prefer the persisted snapshot if it matches the requested form type, 
        // otherwise fall back to the artifact's static data.
        const snapshotData = (activeFormSnapshot && activeFormSnapshot.type === data.formType) 
            ? activeFormSnapshot.data 
            : data.fields;
            
        openModal(data.formType as ModalType, null, { 
            openedByAloa: true,
            id: artifact.id, 
            fields: snapshotData 
        });
    };

    return (
        <div className="space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-white">New {friendlyName}</h4>
            <div className="space-y-2 text-sm max-h-48 overflow-y-auto pr-2">
                {Object.entries(data.fields).map(([key, value]) => (
                    <div key={key}>
                        <p className="text-xs font-semibold text-slate-500 uppercase">{key.replace(/([A-Z])/g, ' $1')}</p>
                        <p className="text-slate-700 dark:text-zinc-300">{String(value)}</p>
                    </div>
                ))}
            </div>
            <button onClick={handleOpen} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
                <EditIcon className="w-4 h-4" /> Open & Finalize
            </button>
        </div>
    );
};
// ... rest of file (DraftArtifact, ConfirmationArtifact, ArtifactRenderer) remains same
const DraftArtifact: React.FC<{ data: { title: string; content: string } }> = ({ data }) => {
    const { openModal } = useUI();
    const { terminology } = useProduct();
    const handleSave = () => {
        openModal('newDocument', null, { openedByAloa: true, draftTitle: data.title, draftContent: data.content });
    };

    return (
         <div className="space-y-3">
            <h4 className="font-bold text-slate-800 dark:text-white truncate">Draft: {data.title}</h4>
            <div className="text-sm max-h-48 overflow-y-auto pr-2 p-2 bg-slate-200/50 dark:bg-zinc-800/50 rounded-md">
                <p className="whitespace-pre-wrap">{data.content}</p>
            </div>
            <button onClick={handleSave} className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700">
                <PlusIcon className="w-4 h-4" /> Save to {terminology.matter}
            </button>
        </div>
    );
};

const ConfirmationArtifact: React.FC<{
    data: AloaConfirmationData;
    onConfirm: (originalForm: any, matchId: string) => void;
    onReject: (originalForm: any) => void;
}> = ({ data, onConfirm, onReject }) => {
    return (
        <div className="space-y-3 text-center">
            <h4 className="font-semibold text-slate-800 dark:text-white">{data.question}</h4>
            <div className="flex justify-center gap-3 pt-2">
                <Button onClick={() => onConfirm(data.originalForm, data.match.id)} size="sm">
                    Yes, switch form
                </Button>
                <Button onClick={() => onReject(data.originalForm)} variant="secondary" size="sm">
                    No, keep current
                </Button>
            </div>
        </div>
    );
};


export const ArtifactRenderer: React.FC<{ 
    artifact: AloaArtifact;
    onConfirm?: (originalForm: any, matchId: string) => void;
    onReject?: (originalForm: any) => void;
}> = ({ artifact, onConfirm, onReject }) => {
    let content: React.ReactNode = null;

    if (artifact.type === 'form') {
        content = <FormArtifact artifact={artifact} />;
    } else if (artifact.type === 'draft') {
        content = <DraftArtifact data={artifact.data} />;
    // } else if (artifact.type === 'note') {
    //    content = <NoteArtifact data={artifact.data} />;
    } else if (artifact.type === 'confirmation' && onConfirm && onReject) {
        content = <ConfirmationArtifact data={artifact.data} onConfirm={onConfirm} onReject={onReject} />;
    } else {
        return null;
    }
    
    return (
        <div className="p-4 bg-white/50 dark:bg-zinc-700/50 rounded-lg border border-black/10 dark:border-white/20">
            {content}
        </div>
    );
};

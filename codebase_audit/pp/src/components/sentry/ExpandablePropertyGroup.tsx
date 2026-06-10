
import React, { useState } from "react";
import { ChevronDown, ChevronRight, Building2, Edit, Trash2 } from "lucide-react";
import { Property, PropertyStatus } from "../../types";

interface ExpandablePropertyGroupProps {
  address: string;
  units: Property[];
  onUnitClick: (unitId: string) => void;
  onEditClick: (unitId: string) => void;
  onDeleteClick: (property: Property) => void;
}

export const ExpandablePropertyGroup: React.FC<ExpandablePropertyGroupProps> = ({
  address,
  units,
  onUnitClick,
  onEditClick,
  onDeleteClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const occupiedCount = units.filter((u) => u.status === PropertyStatus.Occupied).length;

  return (
    <div className="border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden bg-white dark:bg-zinc-800 shadow-sm transition-all mb-3">
      {/* Property header — always visible, tappable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="p-2 bg-slate-100 dark:bg-zinc-700 rounded-lg text-slate-500 shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
              {address}
            </p>
            <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 mt-0.5">
              {units.length} unit{units.length !== 1 ? "s" : ""} • {occupiedCount} occupied
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <div className={`p-1 rounded-md transition-colors ${isExpanded ? 'bg-slate-100 dark:bg-zinc-700 text-primary-600' : 'text-slate-400'}`}>
            {isExpanded ? (
              <ChevronDown className="h-5 w-5" />
            ) : (
              <ChevronRight className="h-5 w-5" />
            )}
          </div>
        </div>
      </button>

      {/* Expandable units list */}
      <div 
        className={`border-t border-slate-100 dark:border-zinc-700/50 bg-slate-50/30 dark:bg-zinc-900/10 overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        {units.map((unit) => (
            <div
              key={unit.id}
              className="group flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-zinc-700/50 last:border-b-0 hover:bg-white dark:hover:bg-zinc-800 transition-colors"
            >
              <div 
                className="flex-1 min-w-0 flex items-center gap-3 cursor-pointer"
                onClick={() => onUnitClick(unit.id)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">
                    {unit.rentalDetails?.unitName || `Unit ${unit.id.slice(-4).toUpperCase()}`}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-full ${
                      unit.status === PropertyStatus.Occupied
                        ? "bg-green-50 text-green-700 border border-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800/30"
                        : "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-zinc-700 dark:text-zinc-400 dark:border-zinc-600"
                    }`}
                  >
                    {unit.status}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditClick(unit.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-md transition-colors"
                  title="Edit Unit"
                >
                  <Edit className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteClick(unit);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                  title="Delete Unit"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <div className="w-px h-4 bg-slate-200 dark:bg-zinc-700 mx-1" />
                <button 
                  onClick={() => onUnitClick(unit.id)}
                  className="p-1 text-slate-300 hover:text-slate-600 dark:hover:text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
    </div>
  );
};

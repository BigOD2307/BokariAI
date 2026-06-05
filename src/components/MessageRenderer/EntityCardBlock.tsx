/**
 * @module MessageRenderer/EntityCardBlock
 * @description Knowledge-panel card for an EntityCardSpec: optional hero image,
 *   name + type chip, a one-line summary, and a key/value attribute list.
 *   Bokari teal accents on a paper surface.
 */
/* eslint-disable @next/next/no-img-element */
import type { EntityCardSpec } from '@/lib/types/multimodal';

const EntityCardBlock: React.FC<{ spec: EntityCardSpec }> = ({ spec }) => {
  if (!spec.name) return null;

  return (
    <div className="my-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-dark-200 overflow-hidden">
      <div className="flex gap-4 p-4">
        {spec.image && (
          <img
            src={spec.image}
            alt={spec.name}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0 bg-black/[0.04]"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-base font-semibold text-black/90 dark:text-white/90">
              {spec.name}
            </h4>
            {spec.entityType && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-bokari-500/10 text-bokari-600 dark:text-bokari-400">
                {spec.entityType}
              </span>
            )}
          </div>
          {spec.summary && (
            <p className="mt-1 text-sm text-black/65 dark:text-white/55 leading-snug">
              {spec.summary}
            </p>
          )}
        </div>
      </div>
      {spec.attributes.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 px-4 pb-4 text-sm">
          {spec.attributes.map((a, i) => (
            <div key={i} className="flex gap-2">
              <dt className="text-black/45 dark:text-white/40 flex-shrink-0">
                {a.label}
              </dt>
              <dd className="text-black/75 dark:text-white/65 font-medium min-w-0">
                {a.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

export default EntityCardBlock;

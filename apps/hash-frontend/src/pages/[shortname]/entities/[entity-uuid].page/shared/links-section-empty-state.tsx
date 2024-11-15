import { Chip } from "@hashintel/design-system";

import { LinksIcon } from "../../../../../shared/icons";
import { SectionWrapper } from "../../../../shared/section-wrapper";
import { SectionEmptyState } from "../../../shared/section-empty-state";

export const LinksSectionEmptyState = ({
  direction,
}: {
  direction: "Incoming" | "Outgoing";
}) => {
  return (
    <SectionWrapper
      title={`${direction} Links`}
      titleStartContent={<Chip label="No links" />}
    >
      <SectionEmptyState
        title={`This entity currently has no ${direction.toLowerCase()} links`}
        titleIcon={<LinksIcon />}
        description="Links contain information about connections or relationships between different entities"
      />
    </SectionWrapper>
  );
};

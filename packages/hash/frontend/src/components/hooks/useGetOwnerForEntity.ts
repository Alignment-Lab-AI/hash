import { Entity, extractOwnedByIdFromEntityId } from "@hashintel/hash-subgraph";
import { useCallback } from "react";
import { nilUuid } from "@hashintel/hash-shared/types";
import { SYSTEM_ACCOUNT_SHORTNAME } from "@hashintel/hash-shared/environment";
import { useUsers } from "./useUsers";
import { useOrgs } from "./useOrgs";

export const useGetOwnerForEntity = () => {
  /*
   * This is a simple way of getting all users and orgs to find an entity's owner's name
   * @todo rethink caching here – users and orgs added since session start won't appear
   * @todo probably replace this with something like fetching owners individually instead
   */
  const { users = [] } = useUsers(true);
  const { orgs = [] } = useOrgs(true);

  return useCallback(
    (entity: Entity) => {
      const ownerUuid = extractOwnedByIdFromEntityId(
        entity.metadata.editionId.baseId,
      );

      const owner =
        // @todo remove this hack when User and Orgs are owned by a real Org
        ownerUuid === nilUuid
          ? {
              orgAccountId: nilUuid,
              shortname: SYSTEM_ACCOUNT_SHORTNAME || "example",
            }
          : users.find((user) => ownerUuid === user.userAccountId) ??
            orgs.find((org) => ownerUuid === org.orgAccountId);

      if (!owner) {
        throw new Error(
          `Owner with accountId ${ownerUuid} not found – possibly a caching issue if it has been created mid-session`,
        );
      }

      const isUser = "userAccountId" in owner;

      return {
        accountId: isUser ? owner.userAccountId : owner.orgAccountId,
        shortname: owner.shortname ?? "incomplete-user-account",
      };
    },
    [orgs, users],
  );
};

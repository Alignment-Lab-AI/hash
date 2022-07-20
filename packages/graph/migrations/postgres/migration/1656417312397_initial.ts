/* eslint-disable @typescript-eslint/naming-convention */
import { MigrationBuilder, ColumnDefinitions } from "node-pg-migrate";
import { stripNewLines } from "../util";

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable(
    "accounts",
    {
      account_id: {
        type: "UUID",
        primaryKey: true,
        comment:
          "Accounts are undecided and just here for satisfying the future schema",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "base_uris",
    {
      base_uri: {
        type: "TEXT",
        primaryKey: true,
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "version_ids",
    {
      version_id: {
        type: "UUID",
        primaryKey: true,
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "ids",
    {
      base_uri: {
        type: "TEXT",
        notNull: true,
        references: "base_uris",
        onDelete: "CASCADE",
      },
      version: {
        type: "INT",
        notNull: true,
      },
      version_id: {
        type: "UUID",
        onDelete: "CASCADE",
        references: "version_ids",
      },
    },
    {
      ifNotExists: true,
      comment: stripNewLines(`
        This table is a boundary to define the actual identification scheme for our kinds of types.
        Assume that we use the UUIDs on the types to look up more specific ID details.
        `),
    },
  );
  pgm.addConstraint("ids", "ids_primary_key", {
    primaryKey: ["base_uri", "version"],
  });

  pgm.createTable(
    "data_types",
    {
      version_id: {
        type: "UUID",
        primaryKey: true,
        references: "version_ids",
        onDelete: "CASCADE",
      },
      schema: {
        type: "JSONB",
        notNull: true,
      },
      created_by: {
        type: "UUID",
        notNull: true,
        references: "accounts",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "property_types",
    {
      version_id: {
        type: "UUID",
        primaryKey: true,
        references: "version_ids",
        onDelete: "CASCADE",
      },
      schema: {
        type: "JSONB",
        notNull: true,
      },
      created_by: {
        type: "UUID",
        notNull: true,
        references: "accounts",
      },
    },
    {
      ifNotExists: true,
    },
  );
  pgm.createTable(
    "entity_types",
    {
      version_id: {
        type: "UUID",
        primaryKey: true,
        references: "version_ids",
        onDelete: "CASCADE",
      },
      schema: {
        type: "JSONB",
        notNull: true,
      },
      created_by: {
        type: "UUID",
        notNull: true,
        references: "accounts",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "link_types",
    {
      version_id: {
        type: "UUID",
        primaryKey: true,
        references: "version_ids",
        onDelete: "CASCADE",
      },
      schema: {
        type: "JSONB",
        notNull: true,
      },
      created_by: {
        type: "UUID",
        notNull: true,
        references: "accounts",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "property_type_property_type_references",
    {
      source_property_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "property_types",
        onDelete: "CASCADE",
      },
      target_property_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "property_types",
        onDelete: "CASCADE",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "property_type_data_type_references",
    {
      source_property_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "property_types",
        onDelete: "CASCADE",
      },
      target_data_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "data_types",
        onDelete: "CASCADE",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "entity_type_property_type_references",
    {
      source_entity_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "entity_types",
        onDelete: "CASCADE",
      },
      target_property_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "property_types",
        onDelete: "CASCADE",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "entity_type_link_type_references",
    {
      source_entity_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "entity_types",
        onDelete: "CASCADE",
      },
      target_link_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "link_types",
        onDelete: "CASCADE",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "entity_type_entity_type_links",
    {
      source_entity_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "entity_types",
        onDelete: "CASCADE",
      },
      target_entity_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "entity_types",
        onDelete: "CASCADE",
      },
    },
    {
      ifNotExists: true,
    },
  );

  pgm.createTable(
    "entities",
    {
      entity_id: {
        type: "UUID",
        primaryKey: true,
      },
      entity_type_version_id: {
        type: "UUID",
        notNull: true,
        references: "property_types",
      },
      properties: {
        type: "JSONB",
        notNull: true,
      },
      created_by: {
        type: "UUID",
        notNull: true,
        references: "accounts",
      },
    },
    {
      ifNotExists: true,
    },
  );
}

// A down migration would cause data loss.
export const down = false;

/* Drop all tables:
DROP TABLE IF EXISTS data_types CASCADE;
DROP TABLE IF EXISTS property_types CASCADE;
DROP TABLE IF EXISTS property_type_property_type_references CASCADE;
DROP TABLE IF EXISTS property_type_data_type_references CASCADE;
DROP TABLE IF EXISTS entity_types CASCADE;
DROP TABLE IF EXISTS entity_type_property_type_references CASCADE;
DROP TABLE IF EXISTS entity_type_link_type_references CASCADE;
DROP TABLE IF EXISTS entity_type_entity_type_links CASCADE;
DROP TABLE IF EXISTS link_types CASCADE;
DROP TABLE IF EXISTS entities CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS ids CASCADE;
*/

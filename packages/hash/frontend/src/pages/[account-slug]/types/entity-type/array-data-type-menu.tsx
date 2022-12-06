import {
  Chip,
  FontAwesomeIcon,
  TextField,
} from "@hashintel/hash-design-system";
import { Autocomplete, Box, Stack, Typography } from "@mui/material";
import { uniqueId } from "lodash";
import { FunctionComponent, useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { usePopupState } from "material-ui-popup-state/hooks";
import { types } from "@hashintel/hash-shared/types";
import { ArrayDataTypeChild } from "./array-data-type-child";
import { DataTypeBadge } from "./data-type-badge";
import { PropertyTypeFormValues } from "./property-type-form";
import {
  dataTypeOptions as primitiveDataTypeOptions,
  customDataTypeOptions,
  dataTypeData,
  getDefaultData,
  DataType,
} from "./property-type-utils";
import { DeleteDataTypeModal } from "./delete-data-type-modal";

const dataTypeOptions = [...primitiveDataTypeOptions, ...customDataTypeOptions];

const deleteDataTypeAndChildren = (
  id: string,
  dataTypes: Record<string, DataType>,
) => {
  let newDataTypes = { ...dataTypes };
  const removedDataType = dataTypes[id];

  if (removedDataType) {
    if (removedDataType.data && "expectedValues" in removedDataType.data) {
      for (const childId of removedDataType.data.expectedValues) {
        newDataTypes = deleteDataTypeAndChildren(childId, newDataTypes);
      }
    }

    delete newDataTypes[removedDataType.id];
  }

  return newDataTypes;
};

type ArrayDataTypeMenuProps = {
  dataTypeId: string;
  prefix?: string;
  deleteTooltip?: string;
  onDelete?: () => void;
  index?: number[];
};

export const ArrayDataTypeMenu: FunctionComponent<ArrayDataTypeMenuProps> = ({
  dataTypeId,
  prefix,
  deleteTooltip,
  onDelete,
  index = [],
}) => {
  const { setValue, control } = useFormContext<PropertyTypeFormValues>();

  const flattenedDataTypes = useWatch({
    control,
    name: `flattenedDataTypeList`,
  });

  const expectedValues = useWatch({
    control,
    name: `flattenedDataTypeList.${dataTypeId}.data.expectedValues`,
  });

  const [dataTypeCount, propertyObjectCount, arrayCount] = useMemo(() => {
    const arrays = expectedValues.filter(
      (childId) => flattenedDataTypes[childId]?.data?.typeId === "array",
    ).length;

    // TODO: change this to flattenedDataTypes[childId]?.data?.typeId === === "object"
    // when object creation is implemented
    const objects = expectedValues.filter(
      (childId) =>
        flattenedDataTypes[childId]?.data?.typeId ===
        types.dataType.object.dataTypeId,
    ).length;

    const dataTypes = expectedValues.length - arrays - objects;

    return [dataTypes, objects, arrays];
  }, [expectedValues, flattenedDataTypes]);

  const deleteModalPopupState = usePopupState({
    variant: "popover",
    popupId: `deleteArray-${dataTypeId}`,
  });

  const deleteDataTypeByTypeId = (typeId: string) => {
    const removedDataType = Object.values(flattenedDataTypes).find(
      (dataType) =>
        dataType.parentId === dataTypeId && dataType.data?.typeId === typeId,
    );

    if (removedDataType) {
      const removedDataTypeId = removedDataType.id;
      setValue(`flattenedDataTypeList.${removedDataTypeId}`, {
        ...removedDataType,
        animatingOut: true,
      });

      setTimeout(() => {
        setValue(
          `flattenedDataTypeList`,
          deleteDataTypeAndChildren(removedDataTypeId, flattenedDataTypes),
        );

        setValue(
          `flattenedDataTypeList.${dataTypeId}.data.expectedValues`,
          expectedValues.filter((childId) => childId !== removedDataTypeId),
        );
      }, 300);
    }

    // trigger popper reposition calculation
    window.dispatchEvent(new Event("resize"));
  };

  const value = useMemo(
    () =>
      expectedValues.map(
        (expectedValue) => flattenedDataTypes[expectedValue]?.data?.typeId,
      ),
    [expectedValues, flattenedDataTypes],
  );

  return (
    <Stack sx={{ mb: 1 }}>
      <DataTypeBadge
        typeId="array"
        prefix={prefix}
        deleteTooltip={deleteTooltip}
        onDelete={() => {
          if (dataTypeCount + arrayCount + propertyObjectCount > 0) {
            deleteModalPopupState.open();
          } else {
            onDelete?.();
          }
        }}
      />

      <Box
        sx={{
          padding: 1.5,
          flex: 1,
          background: ({ palette }) =>
            palette.gray[index.length % 2 !== 0 ? 20 : 10],
          borderBottomRightRadius: 4,
          borderBottomLeftRadius: 4,
          position: "relative",
        }}
      >
        {expectedValues?.map((childId, pos) => (
          <ArrayDataTypeChild
            key={childId}
            id={childId}
            index={[...index, pos]}
            onDelete={(typeId: string) => deleteDataTypeByTypeId(typeId)}
            onlyChild={expectedValues.length === 1}
            firstChild={pos === 0}
          />
        ))}

        <Autocomplete
          value={value}
          multiple
          popupIcon={null}
          clearIcon={null}
          forcePopupIcon={false}
          selectOnFocus={false}
          openOnFocus
          clearOnBlur={false}
          onChange={(_evt, _data, reason, details) => {
            const typeId = details?.option;
            if (typeId) {
              const defaultData = getDefaultData(typeId);

              if (reason === "selectOption") {
                const childId = uniqueId();

                setValue(`flattenedDataTypeList`, {
                  ...(flattenedDataTypes ?? {}),
                  [childId]: {
                    id: childId,
                    parentId: dataTypeId,
                    data: defaultData,
                  },
                });
                setValue(
                  `flattenedDataTypeList.${dataTypeId}.data.expectedValues`,
                  [...expectedValues, childId],
                );

                // trigger popper reposition calculation
                window.dispatchEvent(new Event("resize"));
              } else if (reason === "removeOption") {
                deleteDataTypeByTypeId(typeId);
              }
            }
          }}
          renderTags={() => <Box />}
          renderInput={(inputProps) => (
            <TextField
              {...inputProps}
              sx={{
                alignSelf: "flex-start",
                width: "70%",
              }}
              placeholder="Select acceptable values"
            />
          )}
          options={dataTypeOptions}
          getOptionLabel={(opt) => dataTypeData[opt!]!.title}
          renderOption={(optProps, opt) => {
            return (
              <Box component="li" {...optProps} sx={{ py: 1.5, px: 2.25 }}>
                <FontAwesomeIcon
                  icon={{ icon: dataTypeData[opt!]!.icon }}
                  sx={(theme) => ({ color: theme.palette.gray[50] })}
                />
                <Typography
                  variant="smallTextLabels"
                  component="span"
                  ml={1.5}
                  color={(theme) => theme.palette.gray[80]}
                >
                  {dataTypeData[opt!]!.title}
                </Typography>
                <Chip color="blue" label="DATA TYPE" sx={{ ml: 1.5 }} />
              </Box>
            );
          }}
        />

        <DeleteDataTypeModal
          popupState={deleteModalPopupState}
          onDelete={onDelete}
          onClose={() => deleteModalPopupState.close()}
          dataTypeCount={dataTypeCount}
          arrayCount={arrayCount}
          propertyObjectCount={propertyObjectCount}
        />
      </Box>
    </Stack>
  );
};

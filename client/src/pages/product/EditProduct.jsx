import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Textinput from "@/components/ui/Textinput";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import useToast from "../../hooks/useToast";
import Select from "@/components/ui/Select";

const productUnitsEnum = {
    NOS: "NOS",
    SQUARE_METER: "Sq. M.",
    SQUARE_FEET: "Sq. Ft.",
    SET: "SET",
};

const FormValidationSchema = yup.object().shape({
    name: yup.string().required("Product name is required"),
    alias: yup.string(),
    unitType: yup
        .string()
        .oneOf(Object.keys(productUnitsEnum))
        .required("Unit type is required"),
    ratePerUnit: yup
        .number()
        .typeError("Please enter a valid number")
        .positive("Rate must be positive")
        .required("This field is required"),
    numberOfItems: yup.number().typeError("Please enter a valid number").when('unitType', {
        is: (unitType) => unitType !== 'SET',
        then: (schema) => schema.required("This field is required"),
        otherwise: (schema) => schema.nullable(),
    }),
    numberOfUnits: yup.number().typeError("Please enter a valid number").when('unitType', {
        is: (unitType) => unitType !== 'SET',
        then: (schema) => schema.required("This field is required"),
        otherwise: (schema) => schema.nullable(),
    }),
});

const EditProduct = ({ productId, onComplete, data }) => {
  const { apiCall } = useApi();
  const { toastError, toastSuccess } = useToast();
  const cookies = new Cookies();
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    formState: { errors },
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
  } = useForm({
    resolver: yupResolver(FormValidationSchema),
    mode: "onChange",
  });

  const unitType = watch("unitType");

  useEffect(() => {
    if (show && data) {
      reset({
        name: data.name || "",
        alias: data.alias || "",
        ratePerUnit: data.ratePerUnit || "",
        unitType: data.unitType || "",
        numberOfItems: data.alternateUnits?.numberOfItems || "",
        numberOfUnits: data.alternateUnits?.numberOfUnits || "",
      });
    }
  }, [show, data, reset]);

  // Trigger validation when unit type changes
  useEffect(() => {
    if (unitType) {
      trigger(['numberOfItems', 'numberOfUnits']);
    }
  }, [unitType, trigger]);

  const handleFormSubmit = async (formData) => {
    const payload = {
      name: formData.name,
      alias: formData.alias,
      ratePerUnit: parseFloat(formData.ratePerUnit),
      unitType: formData.unitType,
    };

    // Include alternateUnits only if unit type is not SET
    if (formData.unitType !== 'SET') {
      payload.alternateUnits = {
        numberOfItems: parseInt(formData.numberOfItems),
        numberOfUnits: parseInt(formData.numberOfUnits),
      };
    }

    try {
      setLoading(true);
      const response = await apiCall(
        "PATCH",
        `product/${productId}`,
        payload,
        cookies.get("auth-token")
      );
      if (response && response.product) {
        toastSuccess("Product updated successfully");
        setShow(false);
        onComplete();
      } else {
        toastError(response.message || "Failed to update product");
      }
    } catch (error) {
      toastError("An error occurred while updating the product");
    } finally {
      setLoading(false);
    }
  };

  const onCancel = () => {
    setShow(false);
    reset();
  };

  const handleUnitTypeChange = (value) => {
    setValue("unitType", value);
    // Clear alternate units when switching to SET
    if (value === 'SET') {
      setValue("numberOfItems", "");
      setValue("numberOfUnits", "");
    }
  };

  return (
    <>
      <div className="hover:cursor-pointer" onClick={() => setShow(true)}>
        <Icon icon={"bitcoin-icons:edit-outline"} width={"25px"} />
      </div>
      <Modal
        activeModal={show}
        onClose={onCancel}
        title="Edit Product"
        className="max-w-3xl"
        centered
      >
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="grid grid-cols-2 gap-5"
        >
          <Textinput
            name="name"
            label="Product Name *"
            type="text"
            placeholder="Enter product name"
            register={register}
            error={errors.name}
            divClass="lg:col-span-1 col-span-2"
          />

          <Textinput
            name="alias"
            label="Alias"
            type="text"
            placeholder="Enter alias"
            register={register}
            error={errors.alias}
            divClass="lg:col-span-1 col-span-2"
          />

          <Textinput
            name="ratePerUnit"
            label="Rate Per Unit *"
            type="number"
            placeholder="Enter rate"
            register={register}
            error={errors.ratePerUnit}
            divClass="lg:col-span-1 col-span-2"
          />

          <div className="lg:col-span-1 col-span-2">
            <label className="mb-2 block text-sm font-medium text-red-600">Unit Type *</label>
            <Select
              label=""
              options={Object.entries(productUnitsEnum).map(([key, value]) => ({
                value: key,
                label: value,
              }))}
              field={{
                name: "unitType",
                value: unitType || "",
                onChange: (e) => handleUnitTypeChange(e.target.value),
              }}
              error={errors.unitType}
              placeholder="Select unit type"
            />
          </div>

          {/* Alternate Units - Show for NOS, Sq. M., Sq. Ft. but not for SET */}
          {unitType && unitType !== 'SET' && (
            <>
              <Textinput
                name="numberOfItems"
                label="Alternate Unit: Number of Items *"
                type="number"
                placeholder="e.g., 10"
                register={register}
                error={errors.numberOfItems}
                divClass="lg:col-span-1 col-span-2"
              />

              <Textinput
                name="numberOfUnits"
                label="Alternate Unit: Number of Units *"
                type="number"
                placeholder="e.g., 5"
                register={register}
                error={errors.numberOfUnits}
                divClass="lg:col-span-1 col-span-2"
              />
            </>
          )}

          {/* Show info when SET is selected */}
          {unitType === 'SET' && (
            <div className="col-span-2">
              <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                <div className="font-semibold mb-2 text-blue-800">SET Unit Type</div>
                <p className="text-sm text-blue-700">
                  For SET unit type, alternate units are not required as SET is already a complete unit.
                </p>
              </div>
            </div>
          )}

          <div className="flex justify-center mt-5 gap-4 col-span-2">
            <Button
              text="Cancel"
              className="btn-secondary py-2"
              onClick={onCancel}
            />
            {loading ? (
              <Button
                text="Loading"
                className="btn-primary py-2 pointer-events-none"
                isLoading={true}
              />
            ) : (
              <Button
                text="Submit"
                className="btn-primary py-2"
                type="submit"
              />
            )}
          </div>
        </form>
      </Modal>
    </>
  );
};

export default EditProduct;

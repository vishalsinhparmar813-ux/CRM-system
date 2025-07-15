import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Textinput from "@/components/ui/Textinput";
import Select from "@/components/ui/Select";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
import Cookies from "universal-cookie";
import Modal from "@/components/ui/Modal";

// Mocked Enum for example — replace with real one from server or constants
const productUnitsEnum = {
    NOS: "NOS",
    SQUARE_METER: "SQUARE_METER",
    SQUARE_FEET: "SQUARE_FEET",
    SET: "SET",
};

const AddProduct = ({ onComplete }) => {
    const cookies = new Cookies();
    const { apiCall } = useApi();
    const { toastSuccess, toastError } = useToast();
    const [loading, setLoading] = useState(false);
    const [unitType, setUnitType] = useState("");
    const [productGroups, setProductGroups] = useState([]);
    const [showGroupModal, setShowGroupModal] = useState(false);
    const [newGroup, setNewGroup] = useState({ name: "", description: "", isActive: true });
    const [groupLoading, setGroupLoading] = useState(false);

    // Fetch product groups
    useEffect(() => {
        const fetchProductGroups = async () => {
            const token = cookies.get("auth-token");
            try {
                const response = await apiCall("GET", "productGroup/all", null, token);
                setProductGroups(response || []);
            } catch (err) {
                console.error("Error fetching product groups:", err);
            }
        };
        fetchProductGroups();
    }, []);

    // Keyboard shortcut Alt+C to open group modal (with stopPropagation and capture phase)
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (
                e.altKey && (
                    e.code === "KeyC" ||
                    e.key === "c" ||
                    e.key === "C"
                )
            ) {
                e.preventDefault();
                e.stopPropagation(); // Prevent parent handler
                setShowGroupModal(true);
            }
        };
        window.addEventListener("keydown", handleKeyDown, true); // Capture phase
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, []);

    // Create validation schema based on current unit type
    const createValidationSchema = () => {
        return yup.object().shape({
            name: yup.string().required("Product name is required"),
            alias: yup.string(),
            productGroupId: yup.string(),
            unitType: yup
                .string()
                .oneOf(Object.keys(productUnitsEnum))
                .required("Unit type is required"),
            ratePerUnit: yup
                .number()
                .typeError("Please enter a valid number")
                .positive("Rate must be positive")
                .required("This field is required"),
            alternateUnits: yup.object().shape({
                numberOfItems: yup
                    .number()
                    .typeError("Please enter a valid number")
                    .when('unitType', {
                        is: (val) => val !== 'NOS',
                        then: (schema) => schema.required("This field is required"),
                        otherwise: (schema) => schema.notRequired(),
                    }),
                numberOfUnits: yup
                    .number()
                    .typeError("Please enter a valid number")
                    .when('unitType', {
                        is: (val) => val !== 'NOS',
                        then: (schema) => schema.required("This field is required"),
                        otherwise: (schema) => schema.notRequired(),
                    }),
            }),
        });
    };

    const {
        register,
        control,
        watch,
        reset,
        formState: { errors },
        handleSubmit,
        setValue,
        trigger,
        getValues,
    } = useForm({
        resolver: async (data, context, options) => {
            // Always pass the latest unitType as context
            return yupResolver(createValidationSchema(), { context: { unitType: data.unitType } })(data, context, options);
        },
        mode: "onChange",
        defaultValues: {
            name: "",
            alias: "",
            productGroupId: "",
            unitType: "",
            ratePerUnit: "",
            alternateUnits: {
                numberOfItems: undefined,
                numberOfUnits: undefined,
            },
        },
    });

    const watchedUnitType = watch("unitType");

    // Update validation schema when unit type changes
    useEffect(() => {
        if (watchedUnitType !== unitType) {
            setUnitType(watchedUnitType);
            // Trigger validation for alternate units when unit type changes
            if (watchedUnitType) {
                setTimeout(() => {
                    trigger(['alternateUnits.numberOfItems', 'alternateUnits.numberOfUnits']);
                }, 100);
            }
        }
    }, [watchedUnitType, unitType, trigger]);

    const onSubmit = async (data) => {
        console.log('onSubmit called with data:', data);
        try {
            const payload = {
                name: data.name,
                alias: data.alias,
                productGroupId: data.productGroupId || null,
                unitType: data.unitType,
                ratePerUnit: Number(data.ratePerUnit),
            };

            // Include alternateUnits only if unit type is not NOS
            if (data.unitType !== 'NOS') {
                payload.alternateUnits = {
                    numberOfItems: Number(data.alternateUnits.numberOfItems),
                    numberOfUnits: Number(data.alternateUnits.numberOfUnits),
                };
            }

            setLoading(true);
            const response = await apiCall(
                "POST",
                "product/",
                payload,
                cookies.get("auth-token")
            );

            if (response.success || response.product) {
                toastSuccess("Product added successfully");
                reset();
                setUnitType("");
                onComplete();
            } else {
                toastError(response.message || "Failed to add product");
            }
        } catch (err) {
            console.error("Error adding product:", err);
            toastError("An error occurred while creating the product");
        } finally {
            setLoading(false);
        }
    };

    // Defensive setValue for productGroupId
    const handleProductGroupChange = (e) => {
        const val = e.target.value;
        setValue("productGroupId", typeof val === 'object' && val.value ? val.value : val);
    };

    // Defensive setValue for unitType
    const handleUnitTypeChange = (val) => {
        const value = typeof val === 'object' && val.value ? val.value : val;
        setValue("unitType", value);
        setUnitType(value);
        if (value === 'NOS') {
            setValue("alternateUnits.numberOfItems", 0);
            setValue("alternateUnits.numberOfUnits", 0);
        }
    };

    // Add new product group handler
    const handleAddGroup = async (e) => {
        e.preventDefault();
        if (!newGroup.name.trim()) return;
        setGroupLoading(true);
        try {
            const token = cookies.get("auth-token");
            const res = await apiCall("POST", "productGroup", newGroup, token);
            if (res?.productGroup) {
                setShowGroupModal(false);
                setNewGroup({ name: "", description: "", isActive: true });
                // Refresh product groups and select the new one
                const refreshed = await apiCall("GET", "productGroup/all", null, token);
                setProductGroups(refreshed || []);
                setValue("productGroupId", res.productGroup._id);
                toastSuccess("Product group added!");
            } else {
                toastError(res?.message || "Failed to add group");
            }
        } catch (err) {
            toastError("Error adding group");
        } finally {
            setGroupLoading(false);
        }
    };

    console.log('RENDER AddProductForm');
    console.log('productGroups:', productGroups);
    console.log('unitType:', unitType);
    console.log('watch(productGroupId):', watch("productGroupId"));
    console.log('watch(unitType):', watch("unitType"));

    return (
        <Card
            title={
                <div className="flex gap-3 items-center justify-between w-full">
                    <span>Add New Products</span>
                    <Button
                        className="btn-primary py-2 px-5 flex items-center gap-0.5"
                        onClick={onComplete}
                    >
                        <Icon icon="mdi:arrow-back" width={20} />
                        Back
                    </Button>
                </div>
            }
        >
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* First row: Product Name | Product Alias */}
                <Textinput
                    name="name"
                    label="Product Name *"
                    placeholder="Enter product name"
                    register={register}
                    error={errors.name}
                    divClass="col-span-1"
                />
                <Textinput
                    name="alias"
                    label="Product Alias"
                    placeholder="Enter product alias"
                    register={register}
                    error={errors.alias}
                    divClass="col-span-1"
                />

                {/* Second row: Product Group (with + button) */}
                <div className="col-span-1 md:col-span-2 flex items-center gap-2 max-w-md">
                    <div className="flex-1 min-w-0">
                        <label className={`mb-2 block text-sm font-medium ${errors.productGroupId ? 'text-red-600' : ''}`}>Product Group</label>
                        <Select
                            label=""
                            className="h-[42px]"
                            options={[
                                { value: "", label: "Select Product Group" },
                                ...productGroups.map(group => ({
                                    value: group._id,
                                    label: group.name,
                                }))
                            ]}
                            field={{
                                name: "productGroupId",
                                value: typeof watch("productGroupId") === "object" && watch("productGroupId") !== null
                                    ? watch("productGroupId").value
                                    : String(watch("productGroupId") || ""),
                                onChange: handleProductGroupChange,
                            }}
                            error={errors.productGroupId}
                            placeholder="Select product group"
                        />
                    </div>
                    <Button type="button" className="btn btn-outline-primary h-[42px] flex items-center" onClick={() => setShowGroupModal(true)} title="Add Product Group (Alt+C)">
                        +
                    </Button>
                </div>

                {/* Third row: Unit Type | Rate Per Unit */}
                <div className="col-span-1">
                    <label className={`mb-2 block text-sm font-medium ${errors.unitType ? 'text-red-600' : ''}`}>Unit Type *</label>
                    <Select
                        label=""
                        className="h-[42px]"
                        options={Object.entries(productUnitsEnum).map(([key, value]) => ({
                            value: key,
                            label: value,
                        }))}
                        field={{
                            name: "unitType",
                            value: typeof unitType === "object" && unitType !== null
                                ? unitType.value
                                : String(unitType || ""),
                            onChange: (e) => {
                                const value = e.target.value;
                                setValue("unitType", value, { shouldValidate: true });
                                setUnitType(value);
                                if (value === 'NOS') {
                                    setValue("alternateUnits.numberOfItems", 0);
                                    setValue("alternateUnits.numberOfUnits", 0);
                                }
                                trigger("unitType");
                            },
                        }}
                        error={errors.unitType}
                        placeholder="Select unit type"
                    />
                </div>
                <Textinput
                    name="ratePerUnit"
                    label="Rate Per Unit *"
                    type="number"
                    placeholder="Enter rate"
                    register={register}
                    error={errors.ratePerUnit}
                    divClass="col-span-1"
                />

                {/* Alternate Units Box Start */}
                {unitType && unitType !== 'NOS' && (
                    <div className="col-span-1 md:col-span-2">
                        <div className="border rounded-lg p-4 bg-gray-50">
                            <div className="font-semibold mb-2 text-red-600">Alternate Units *</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Textinput
                                    name="alternateUnits.numberOfItems"
                                    label="Number of Items *"
                                    type="number"
                                    placeholder="e.g. 10"
                                    register={register}
                                    registerOptions={{ valueAsNumber: true }}
                                    error={errors?.alternateUnits?.numberOfItems}
                                    divClass="col-span-1"
                                />
                                <Textinput
                                    name="alternateUnits.numberOfUnits"
                                    label="Number of Units *"
                                    type="number"
                                    placeholder="e.g. 5"
                                    register={register}
                                    registerOptions={{ valueAsNumber: true }}
                                    error={errors?.alternateUnits?.numberOfUnits}
                                    divClass="col-span-1"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Show info when NOS is selected */}
                {unitType === 'NOS' && (
                    <div className="col-span-1 md:col-span-2">
                        <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
                            <div className="font-semibold mb-2 text-blue-800">NOS Unit Type</div>
                            <p className="text-sm text-blue-700">
                                For NOS (Number of Sets) unit type, alternate units are not required.
                            </p>
                        </div>
                    </div>
                )}

                <div className="col-span-1 md:col-span-2 flex justify-end">
                    <Button type="submit" className="btn btn-primary" disabled={loading}>
                        {loading ? "Adding..." : "Submit"}
                    </Button>
                </div>
            </form>
            <Modal activeModal={showGroupModal} onClose={() => setShowGroupModal(false)} title="Add Product Group" className="max-w-md" centered>
                <form onSubmit={handleAddGroup} className="space-y-4">
                    <Textinput label="Group Name *" value={newGroup.name} onChange={e => setNewGroup(g => ({ ...g, name: e.target.value }))} required />
                    <Textinput label="Description" value={newGroup.description} onChange={e => setNewGroup(g => ({ ...g, description: e.target.value }))} />
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={newGroup.isActive} onChange={e => setNewGroup(g => ({ ...g, isActive: e.target.checked }))} id="isActive" />
                        <label htmlFor="isActive">Active</label>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" className="btn btn-outline-secondary" onClick={() => setShowGroupModal(false)}>Cancel</Button>
                        <Button type="submit" className="btn btn-primary" disabled={groupLoading}>{groupLoading ? "Adding..." : "Add Group"}</Button>
                    </div>
                </form>
            </Modal>
        </Card>
    );
};

export default AddProduct;

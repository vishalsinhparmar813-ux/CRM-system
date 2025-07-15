import React, { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import Textinput from "@/components/ui/Textinput";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import useApi from "../../hooks/useApi";
import useToast from "../../hooks/useToast";
import Cookies from "universal-cookie";

const schema = yup.object().shape({
  orderNo: yup.string().required("Order Number is required"),
  clientId: yup.string().required("Client is required"),
  productId: yup.string().required("Product is required"),
  quantity: yup
    .number()
    .typeError("Quantity must be a number")
    .positive("Must be greater than 0")
    .required("Quantity is required"),
});

const SubOrderForm = ({ onComplete }) => {
  const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm({
    resolver: yupResolver(schema),
    mode: "onBlur",
  });

  const { apiCall } = useApi();
  const { toastSuccess, toastError } = useToast();
  const cookies = new Cookies();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const watchedProductId = watch("productId");

  useEffect(() => {
    const fetchData = async () => {
      const token = cookies.get("auth-token");
      try {
        const clientsRes = await apiCall("GET", "client/all", null, token);
        const productsRes = await apiCall("GET", "product/all", null, token);

        setClients(clientsRes || []);
        setProducts(productsRes?.products || []);
      } catch (error) {
        console.error("Error fetching data:", error);
        toastError("Failed to fetch client or product data");
      }
    };
    fetchData();
  }, []);

  // Update selected product when productId changes
  useEffect(() => {
    if (watchedProductId) {
      const product = products.find(p => p._id === watchedProductId);
      setSelectedProduct(product || null);
    } else {
      setSelectedProduct(null);
    }
  }, [watchedProductId, products]);

  const onSubmit = async (formData) => {
    if (!selectedProduct) {
      toastError("Please select a product");
      return;
    }

    const token = cookies.get("auth-token");
    const payload = {
      orderNo: formData.orderNo,
      clientId: formData.clientId,
      productId: formData.productId,
      quantity: Number(formData.quantity),
      unitType: selectedProduct.unitType, // Default to product's unit type
    };

    setLoading(true);
    try {
      const response = await apiCall("POST", "sub-order/", payload, token);
      if (response?.subOrderId) {
        toastSuccess("SubOrder created successfully");
        reset();
        setSelectedProduct(null);
        onComplete?.();
      } else {
        toastError(response?.message || "Failed to create suborder");
      }
    } catch (err) {
      toastError("An error occurred while creating the suborder");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card title="Add SubOrder">
      <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Textinput
          name="orderNo"
          label="Order Number"
          placeholder="Enter order number"
          register={register}
          error={errors.orderNo}
        />
        <Controller
          name="clientId"
          control={control}
          render={({ field }) => (
            <Select
              label="Client Name"
              options={clients.map(client => ({
                label: `${client.name}`,
                value: client._id,
              }))}
              field={field}
              error={errors.clientId}
            />
          )}
        />
        <Controller
          name="productId"
          control={control}
          render={({ field }) => (
            <Select
              label="Product Name"
              options={products.map(product => ({
                label: product.name,
                value: product._id,
              }))}
              field={field}
              error={errors.productId}
            />
          )}
        />
        <Textinput
          name="quantity"
          label={`Quantity ${selectedProduct ? `(${selectedProduct.unitType})` : ''}`}
          type="number"
          placeholder="Enter quantity"
          register={register}
          error={errors.quantity}
        />
        {selectedProduct && (
          <div className="lg:col-span-2 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Product:</strong> {selectedProduct.name} | 
              <strong> Unit Type:</strong> {selectedProduct.unitType} | 
              <strong> Rate:</strong> ₹{selectedProduct.ratePerUnit}/{selectedProduct.unitType}
            </p>
          </div>
        )}
        <div className="col-span-2">
          <Button type="submit" isLoading={loading}>
            Submit
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default SubOrderForm;

import React from "react";
import Swal from "sweetalert2";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const DeleteProduct = ({ productId, onDeleteSuccess }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();

  const handleDelete = async () => {
    Swal.fire({
      title: "Do you really want to delete this product?",
      showDenyButton: true,
      confirmButtonText: "Yes",
      denyButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const deleteResult = await apiCall(
            "DELETE",
            `product/${productId}`, // ✅ Now using correct prop
            undefined,
            cookies.get("auth-token")
          );
          if (deleteResult.success || deleteResult.message === "Product deleted successfully") {
            onDeleteSuccess(); // Refresh UI
            Swal.fire("Product deleted successfully", "", "success");
          } else {
            Swal.fire(deleteResult.message || "Error deleting product", "", "error");
          }
        } catch (error) {
          Swal.fire("Error deleting product", "", "error");
        }
      }
    });
  };

  return (
    <div className="hover:cursor-pointer" onClick={handleDelete}>
      <Icon icon="fluent:delete-20-regular" width={25} />
    </div>
  );
};

export default DeleteProduct;

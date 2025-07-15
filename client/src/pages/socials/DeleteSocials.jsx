import React from "react";
import Swal from "sweetalert2";
import Icon from "@/components/ui/Icon";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";

const DeleteSocials = ({ selectedSocialId, onDeleteSuccess }) => {
  const { apiCall } = useApi();
  const cookies = new Cookies();

  const handleDelete = async () => {
    Swal.fire({
      title: "Do you really want to delete this Social?",
      showDenyButton: true,
      confirmButtonText: "Yes",
      denyButtonText: "No",
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const deleteResult = await apiCall(
            "DELETE",
            "admin/socials-name",
            { socialId: selectedSocialId },
            cookies.get("auth-token")
          );
          if (deleteResult.success) {
            onDeleteSuccess();
            Swal.fire("Social deleted successfully", "", "success");
          } else {
            Swal.fire("Error deleting social", "", "error");
          }
        } catch (error) {
          Swal.fire("Error deleting social", "", "error");
        }
      }
    });
  };

  return (
    <div className="hover:cursor-pointer" onClick={handleDelete}>
      <Icon icon={"fluent:delete-20-regular"} width={25} />
    </div>
  );
};

export default DeleteSocials;

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import Textinput from "@/components/ui/Textinput";
import useApi from "../../hooks/useApi";
import Cookies from "universal-cookie";
import useToast from "../../hooks/useToast";

const EditSocialName = ({ socialName, socialId, onSubmit, onCancel }) => {
  const [show, setShow] = useState(false);
  const { register, formState: { errors }, handleSubmit, reset, setValue, clearErrors } = useForm({
    defaultValues: { name: socialName }
  });
  const { apiCall } = useApi();
  const cookies = new Cookies();
  const { toastSuccess, toastError } = useToast();
  const [loading, setLoading] = useState(false);


  useEffect(() => {
    setValue("name", socialName);
  }, [socialName]);

  const handleSetShow = () => {
    setShow(!show);
    clearErrors();
  };

  const handleFormSubmit = async (data) => {
    try {
      setLoading(true)
      const response = await apiCall(
        "PUT",
        "admin/socials-name",
        { name: data.name, socialId: socialId },
        cookies.get("auth-token")
      );
      if (response.success) {
        toastSuccess("Social name updated successfully");
        onSubmit({ ...data, socialId });
        setShow(false);
      } else {
        toastError(response.message || "Failed to update social name");
      }
    } catch (error) {
      toastError("An error occurred while updating the social name");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="hover:cursor-pointer" onClick={handleSetShow}>
        <Icon icon={"bitcoin-icons:edit-outline"} width={25} />
      </div>
      <Modal
        activeModal={show}
        onClose={() => setShow(false)}
        title="Edit Social Name"
        className="max-w-3xl"
        centered
      >
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <div className="mb-3">
            <Textinput
              name="name"
              label="Social Name"
              type="text"
              placeholder="Enter social name"
              register={register}
              error={errors.name}
            />
          </div>
          <div className="flex justify-end gap-4">
            <Button
              text="Cancel"
              className="btn-secondary py-2"
              onClick={() => {
                reset();
                setShow(false);
                onCancel();
              }}
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

export default EditSocialName;

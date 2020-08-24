import { decimal, weight } from "@saleor/misc";
import { ProductUpdatePageSubmitData } from "@saleor/products/components/ProductUpdatePage";
import { ProductDetails_product } from "@saleor/products/types/ProductDetails";
import { ProductImageCreateVariables } from "@saleor/products/types/ProductImageCreate";
import { ProductImageReorderVariables } from "@saleor/products/types/ProductImageReorder";
import {
  ProductUpdate,
  ProductUpdateVariables
} from "@saleor/products/types/ProductUpdate";
import {
  SimpleProductUpdate,
  SimpleProductUpdateVariables
} from "@saleor/products/types/SimpleProductUpdate";
import { mapFormsetStockToStockInput } from "@saleor/products/utils/data";
import { ReorderEvent } from "@saleor/types";
import { UpdateMetadataVariables } from "@saleor/utils/metadata/types/UpdateMetadata";
import { UpdatePrivateMetadataVariables } from "@saleor/utils/metadata/types/UpdatePrivateMetadata";
import { diff } from "fast-array-diff";
import { MutationFetchResult } from "react-apollo";
import { arrayMove } from "react-sortable-hoc";

export function createUpdateHandler(
  product: ProductDetails_product,
  updateProduct: (
    variables: ProductUpdateVariables
  ) => Promise<MutationFetchResult<ProductUpdate>>,
  updateSimpleProduct: (
    variables: SimpleProductUpdateVariables
  ) => Promise<MutationFetchResult<SimpleProductUpdate>>,
  updateMetadata: (variables: UpdateMetadataVariables) => Promise<any>,
  updatePrivateMetadata: (
    variables: UpdatePrivateMetadataVariables
  ) => Promise<any>
) {
  return async (data: ProductUpdatePageSubmitData) => {
    const productVariables: ProductUpdateVariables = {
      attributes: data.attributes.map(attribute => ({
        id: attribute.id,
        values: attribute.value[0] === "" ? [] : attribute.value
      })),
      basePrice: decimal(data.basePrice),
      category: data.category,
      chargeTaxes: data.chargeTaxes,
      collections: data.collections,
      descriptionJson: JSON.stringify(data.description),
      id: product.id,
      isPublished: data.isPublished,
      name: data.name,
      publicationDate:
        data.publicationDate !== "" ? data.publicationDate : null,
      seo: {
        description: data.seoDescription,
        title: data.seoTitle
      }
    };

    let errors: any[];

    if (product.productType.hasVariants) {
      const result = await updateProduct(productVariables);
      errors = result.data.productUpdate.errors;
    } else {
      const result = await updateSimpleProduct({
        ...productVariables,
        addStocks: data.addStocks.map(mapFormsetStockToStockInput),
        deleteStocks: data.removeStocks,
        productVariantId: product.variants[0].id,
        productVariantInput: {
          sku: data.sku,
          trackInventory: data.trackInventory
        },
        updateStocks: data.updateStocks.map(mapFormsetStockToStockInput),
        weight: weight(data.weight)
      });
      errors = [
        ...result.data.productUpdate.errors,
        ...result.data.productVariantStocksCreate.errors,
        ...result.data.productVariantStocksDelete.errors,
        ...result.data.productVariantStocksUpdate.errors,
        ...result.data.productVariantUpdate.errors
      ];
    }

    if (errors.length === 0) {
      if (data.metadata) {
        const metaDiff = diff(
          product.metadata,
          data.metadata,
          (a, b) => a.key === b.key
        );

        updateMetadata({
          id: product.id,
          input: data.metadata,
          keysToDelete: metaDiff.removed.map(meta => meta.key)
        });
      }
      if (data.privateMetadata) {
        const privateMetaDiff = diff(
          product.privateMetadata,
          data.privateMetadata,
          (a, b) => a.key === b.key
        );

        updatePrivateMetadata({
          id: product.id,
          input: data.privateMetadata,
          keysToDelete: privateMetaDiff.removed.map(meta => meta.key)
        });
      }
    }
  };
}

export function createImageUploadHandler(
  id: string,
  createProductImage: (variables: ProductImageCreateVariables) => void
) {
  return (file: File) =>
    createProductImage({
      alt: "",
      image: file,
      product: id
    });
}

export function createImageReorderHandler(
  product: ProductDetails_product,
  reorderProductImages: (variables: ProductImageReorderVariables) => void
) {
  return ({ newIndex, oldIndex }: ReorderEvent) => {
    let ids = product.images.map(image => image.id);
    ids = arrayMove(ids, oldIndex, newIndex);
    reorderProductImages({
      imagesIds: ids,
      productId: product.id
    });
  };
}

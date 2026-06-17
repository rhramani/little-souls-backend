const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const catalogues = await prisma.catalogue.findMany({
    include: { products: true }
  });
  console.log('Catalogues found:', catalogues.map(c => ({ id: c.id, name: c.name, productsCount: c.products.length })));
  
  if (catalogues.length > 0) {
    const id = catalogues[catalogues.length - 1].id;
    console.log('Attempting to delete catalogue:', id);
    try {
      // Replicate the service logic
      await prisma.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { catalogueId: id },
        });
        console.log('Products in catalog:', products.map(p => p.id));
        for (const product of products) {
          const orderItemCount = await tx.orderItem.count({ where: { productId: product.id } });
          const purchaseOrderItemCount = await tx.purchaseOrderItem.count({ where: { productId: product.id } });
          const backorderApprovalCount = await tx.backorderApproval.count({ where: { productId: product.id } });
          console.log(`Product ${product.id} reference counts:`, { orderItemCount, purchaseOrderItemCount, backorderApprovalCount });
          
          const isReferenced = orderItemCount > 0 || purchaseOrderItemCount > 0 || backorderApprovalCount > 0;
          if (isReferenced) {
            console.log(`Product ${product.id} is referenced, updating to null...`);
            await tx.product.update({
              where: { id: product.id },
              data: { catalogueId: null, isActive: false },
            });
          } else {
            console.log(`Product ${product.id} is NOT referenced, deleting relations...`);
            await tx.imageCleaningTask.deleteMany({ where: { productId: product.id } });
            await tx.productImage.deleteMany({ where: { productId: product.id } });
            await tx.productPricing.deleteMany({ where: { productId: product.id } });
            await tx.productCatalogFile.deleteMany({ where: { productId: product.id } });
            await tx.productVideo.deleteMany({ where: { productId: product.id } });
            await tx.cartItem.deleteMany({ where: { productId: product.id } });
            await tx.stockMovement.deleteMany({ where: { productId: product.id } });
            await tx.backorderApproval.deleteMany({ where: { productId: product.id } });
            
            console.log(`Deleting product ${product.id}...`);
            await tx.product.delete({ where: { id: product.id } });
          }
        }
        console.log('Deleting catalogue...');
        await tx.catalogue.delete({ where: { id } });
      });
      console.log('SUCCESS!');
    } catch (err) {
      console.error('ERROR OCCURRED:', err);
    }
  }
  await prisma.$disconnect();
}

main();
